import { describe, it, expect } from "vitest";
import { calculateColoradoTax } from "../states/coloradoTaxCalculator";
import { calculateFederalTax } from "../federalTaxCalculator";
import { SUPPORTED_YEARS, TAX_YEAR, TaxYear } from "../config";
import { FilingStatus, TaxInputs } from "../types";
import { createDefaultInputs, loadTestDataForYear } from "./testData";

// Run the federal return first and hand it to Colorado, as the app does. The
// federal return takes the larger of the standard and itemized deduction.
// The filer is single unless the test says otherwise.
function calculateColorado(
  overrides: Partial<TaxInputs>,
  year: TaxYear = TAX_YEAR,
) {
  const data = loadTestDataForYear(year);
  const inputs = createDefaultInputs({
    selectedState: "colorado",
    taxYear: year,
    ...overrides,
  });
  const federal = calculateFederalTax(
    inputs,
    data.federalBrackets,
    data.ltcgBrackets,
    data.federalDeductions,
    data.sharedLimits,
    data.federalLimits,
    data.ficaData,
  );
  const colorado = calculateColoradoTax(
    inputs,
    data.coloradoBrackets,
    data.sharedLimits,
    data.coloradoLimits,
    federal,
    data.ficaData,
  );
  return { colorado, federal };
}

// The federal standard deduction is $16,100 ($32,200 married filing jointly),
// so wages of $116,100 leave a single filer $100,000 of federal taxable
// income and 4.4% x $100,000 = $4,400 of Colorado tax. Many tests below use
// that figure.

describe("calculateColoradoTax", () => {
  describe("worked examples", () => {
    it("single filer taking the federal standard deduction: $100,000 of wages and $1,500 of gifts", () => {
      // Federal taxable income: $100,000 - $16,100 standard = $83,900
      //   ($3,000 of Colorado tax and the gifts come nowhere near $16,100)
      // Charitable subtraction: $1,500 - $500 = $1,000
      // Colorado taxable:       $83,900 - $1,000 = $82,900
      // Tax:                    4.4% x $82,900 = $3,647.60
      // Owed:                   $3,647.60 - $3,000 withheld = $647.60
      // Safe harbor:            70% x $3,647.60 = $2,553.32; $3,000 meets it
      const { colorado, federal } = calculateColorado({
        federalIncome: 100000,
        charitableContributions: 1500,
        stateTaxWithheld: 3000,
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("standard");
      expect(colorado.coloradoAdjustments).toEqual({
        charitableSubtraction: 1000,
        deductionAddback: 0,
        federalTaxableIncome: 83900,
        treasuryInterestSubtraction: 0,
      });
      expect(colorado.taxableOrdinaryIncome).toBe(82900);
      expect(colorado.totalTax).toBeCloseTo(3647.6, 2);
      expect(colorado.remainingOwed).toBeCloseTo(647.6, 2);
      expect(colorado.refundDue).toBe(0);
      expect(colorado.safeHarbor!.minimum).toBeCloseTo(2553.32, 2);
      expect(colorado.safeHarbor!.met).toBe(true);
    });

    it("married couple itemizing: $200,000 of wages, with $8,000 of Colorado tax added back", () => {
      // Federal itemized: $8,000 Colorado tax + $6,000 property tax
      //   = $14,000 of state and local taxes, $24,000 mortgage interest, and
      //   $5,000 of gifts less the 0.5% x $200,000 = $1,000 floor = $4,000.
      //   $42,000 beats the $32,200 standard deduction.
      // Federal taxable income: $200,000 - $42,000 = $158,000
      // State income tax addback: the lesser of
      //   $14,000 - $6,000 property tax = $8,000, and
      //   $42,000 - $32,200 = $9,800 gained by itemizing
      // No charitable subtraction for an itemizer
      // Colorado taxable: $158,000 + $8,000 = $166,000
      // Tax:              4.4% x $166,000 = $7,304
      // Refund:           $8,000 withheld - $7,304 = $696
      const { colorado, federal } = calculateColorado({
        federalIncome: 200000,
        stateTaxWithheld: 8000,
        propertyTaxesPaid: 6000,
        mortgageInterestPaid: 24000,
        charitableContributions: 5000,
        filingStatus: "marriedFilingJointly",
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(federal.deductionBreakdown.deductionAmount).toBe(42000);
      expect(colorado.coloradoAdjustments).toEqual({
        charitableSubtraction: 0,
        deductionAddback: 8000,
        federalTaxableIncome: 158000,
        treasuryInterestSubtraction: 0,
      });
      expect(colorado.taxableOrdinaryIncome).toBe(166000);
      expect(colorado.totalTax).toBeCloseTo(7304, 2);
      expect(colorado.remainingOwed).toBe(0);
      expect(colorado.refundDue).toBeCloseTo(696, 2);
    });

    it("married couple with $500,000 of wages: all but $2,000 of the standard deduction added back", () => {
      // Federal taxable income: $500,000 - $32,200 standard = $467,800
      // Deduction addback (federal AGI of $300,000 or more):
      //   $32,200 - $2,000 = $30,200
      // Colorado taxable: $467,800 + $30,200 = $498,000
      // Tax:              4.4% x $498,000 = $21,912
      // Owed:             $21,912 - $20,000 of estimated payments = $1,912
      // Safe harbor:      70% x $21,912 = $15,338.40; $20,000 meets it
      const { colorado } = calculateColorado({
        federalIncome: 500000,
        stateEstimatedPaid: 20000,
        filingStatus: "marriedFilingJointly",
      });

      expect(colorado.coloradoAdjustments).toEqual({
        charitableSubtraction: 0,
        deductionAddback: 30200,
        federalTaxableIncome: 467800,
        treasuryInterestSubtraction: 0,
      });
      expect(colorado.taxableOrdinaryIncome).toBe(498000);
      expect(colorado.totalTax).toBeCloseTo(21912, 2);
      expect(colorado.remainingOwed).toBeCloseTo(1912, 2);
      expect(colorado.safeHarbor!.minimum).toBeCloseTo(15338.4, 2);
      expect(colorado.safeHarbor!.met).toBe(true);
    });
  });

  describe("4.4% flat rate on federal taxable income", () => {
    it("taxes $100,000 of federal taxable income at 4.4%: $4,400", () => {
      const { colorado, federal } = calculateColorado({
        federalIncome: 116100,
      });

      expect(federal.taxableOrdinaryIncome).toBe(100000);
      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(100000);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
      expect(colorado.ordinaryIncomeBracketBreakdown).toHaveLength(1);
      expect(colorado.ordinaryIncomeBracketBreakdown[0].rate).toBe(0.044);
      expect(colorado.ordinaryIncomeTax).toBeCloseTo(4400, 2);
      expect(colorado.totalTax).toBeCloseTo(4400, 2);
    });

    // Wages are the federal standard deduction for the filing status plus
    // $100,000
    it.each<{ filingStatus: FilingStatus; wages: number }>([
      { filingStatus: "single", wages: 116100 },
      { filingStatus: "marriedFilingJointly", wages: 132200 },
      { filingStatus: "marriedFilingSeparately", wages: 116100 },
    ])(
      "uses the same rate for $filingStatus (4,400 on 100,000 of taxable income)",
      ({ filingStatus, wages }) => {
        const { colorado } = calculateColorado({
          federalIncome: wages,
          filingStatus,
        });

        expect(colorado.taxableOrdinaryIncome).toBe(100000);
        expect(colorado.totalTax).toBeCloseTo(4400, 2);
      },
    );

    it("taxes long-term gains and qualified dividends at the same 4.4%", () => {
      // $66,100 wages + $30,000 long-term gain + $20,000 qualified dividends
      // = $116,100. The federal return taxes $50,000 at ordinary rates and
      // $50,000 at long-term rates; Colorado taxes all $100,000 at 4.4%.
      const { colorado, federal } = calculateColorado({
        federalIncome: 66100,
        longTermCapitalGains: 30000,
        ordinaryDividends: 20000,
        qualifiedDividends: 20000,
      });

      expect(federal.taxableOrdinaryIncome).toBe(50000);
      expect(federal.taxableLTCG).toBe(50000);
      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(100000);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
      expect(colorado.taxableLTCG).toBe(0);
      expect(colorado.ltcgTax).toBe(0);
      expect(colorado.ltcgBracketBreakdown).toEqual([]);
      expect(colorado.totalTax).toBeCloseTo(4400, 2);
    });

    it("reports no deduction of its own, because the federal one is already taken", () => {
      const { colorado } = calculateColorado({ federalIncome: 116100 });

      expect(colorado.deductionBreakdown.deductionAmount).toBe(0);
      expect(colorado.deductionBreakdown.standardDeduction).toBe(0);
      expect(colorado.deductionBreakdown.itemizedDeduction).toBe(0);
    });
  });

  describe("state income tax addback", () => {
    it("adds back state income tax deducted on the federal return: $6,000", () => {
      // Federal itemized: $6,000 Colorado tax + $4,000 property tax +
      //   $14,000 mortgage interest = $24,000, against $16,100 standard
      // Federal taxable income: $150,000 - $24,000 = $126,000
      // Addback: the lesser of $10,000 - $4,000 property tax = $6,000 and
      //   $24,000 - $16,100 = $7,900
      // Colorado taxable: $126,000 + $6,000 = $132,000
      // Tax: 4.4% x $132,000 = $5,808
      const { colorado } = calculateColorado({
        federalIncome: 150000,
        stateTaxWithheld: 6000,
        propertyTaxesPaid: 4000,
        mortgageInterestPaid: 14000,
      });

      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(126000);
      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(6000);
      expect(colorado.taxableOrdinaryIncome).toBe(132000);
      expect(colorado.totalTax).toBeCloseTo(5808, 2);
    });

    it("limits the addback to what itemizing gained over the standard deduction: $900", () => {
      // Federal itemized: $6,000 Colorado tax + $11,000 mortgage interest
      //   = $17,000, only $900 more than the $16,100 standard deduction
      // Federal taxable income: $150,000 - $17,000 = $133,000
      // Colorado taxable: $133,000 + $900 = $133,900
      // Tax: 4.4% x $133,900 = $5,891.60
      const { colorado } = calculateColorado({
        federalIncome: 150000,
        stateTaxWithheld: 6000,
        mortgageInterestPaid: 11000,
      });

      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(900);
      expect(colorado.taxableOrdinaryIncome).toBe(133900);
      expect(colorado.totalTax).toBeCloseTo(5891.6, 2);
    });

    it("treats property tax as using the $40,400 federal cap first", () => {
      // $20,000 Colorado tax + $30,000 property tax = $50,000, capped at
      // $40,400. Property tax fills $30,000 of the cap, so only $10,400 of
      // state income tax was deducted.
      // Federal taxable income: $290,000 - $40,400 = $249,600
      // Addback: the lesser of $40,400 - $30,000 = $10,400 and
      //   $40,400 - $16,100 = $24,300
      // Colorado taxable: $249,600 + $10,400 = $260,000
      // Tax: 4.4% x $260,000 = $11,440
      const { colorado, federal } = calculateColorado({
        federalIncome: 290000,
        stateTaxWithheld: 20000,
        propertyTaxesPaid: 30000,
      });

      expect(federal.deductionBreakdown.saltDeduction).toBe(40400);
      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(10400);
      expect(colorado.taxableOrdinaryIncome).toBe(260000);
      expect(colorado.totalTax).toBeCloseTo(11440, 2);
    });

    it("adds nothing back when property tax alone reaches the federal cap", () => {
      // $20,000 Colorado tax + $45,000 property tax, capped at $40,400: the
      // property tax uses the whole cap, so no state income tax was deducted
      // Colorado taxable: $290,000 - $40,400 = $249,600
      const { colorado } = calculateColorado({
        federalIncome: 290000,
        stateTaxWithheld: 20000,
        propertyTaxesPaid: 45000,
      });

      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(249600);
    });

    it("adds nothing back when the federal return takes the standard deduction", () => {
      // $6,000 of Colorado tax is less than the $16,100 standard deduction,
      // so it was never deducted
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        stateTaxWithheld: 6000,
      });

      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
    });
  });

  describe("deduction addback at $300,000 or more of federal AGI", () => {
    // With wages only and the standard deduction, the addback returns all
    // but the limit to taxable income:
    // single and married filing separately $16,100 - $1,000 = $15,100
    // married filing jointly               $32,200 - $2,000 = $30,200
    it.each<{
      filingStatus: FilingStatus;
      limit: string;
      addback: number;
      taxable: number;
    }>([
      {
        filingStatus: "single",
        limit: "$1,000",
        addback: 15100,
        taxable: 399000,
      },
      {
        filingStatus: "marriedFilingJointly",
        limit: "$2,000",
        addback: 30200,
        taxable: 398000,
      },
      {
        filingStatus: "marriedFilingSeparately",
        limit: "$1,000",
        addback: 15100,
        taxable: 399000,
      },
    ])(
      "adds back the deduction above $limit for $filingStatus",
      ({ filingStatus, addback, taxable }) => {
        const { colorado } = calculateColorado({
          federalIncome: 400000,
          filingStatus,
        });

        expect(colorado.coloradoAdjustments!.deductionAddback).toBe(addback);
        expect(colorado.taxableOrdinaryIncome).toBe(taxable);
      },
    );

    it("applies at exactly $300,000 of federal AGI", () => {
      // Federal taxable income: $300,000 - $16,100 = $283,900
      // Colorado taxable: $283,900 + $15,100 = $299,000
      // Tax: 4.4% x $299,000 = $13,156
      const { colorado, federal } = calculateColorado({
        federalIncome: 300000,
      });

      expect(federal.adjustedGrossIncome).toBe(300000);
      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(15100);
      expect(colorado.taxableOrdinaryIncome).toBe(299000);
      expect(colorado.totalTax).toBeCloseTo(13156, 2);
    });

    it("does not apply at $299,999 of federal AGI", () => {
      // Colorado taxable: $299,999 - $16,100 = $283,899, with no addback
      const { colorado } = calculateColorado({ federalIncome: 299999 });

      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(283899);
    });

    it("measures the $300,000 against federal AGI, not wages", () => {
      // $320,000 of wages less $24,500 of 401(k) contributions is an AGI of
      // $295,500, so there is no addback
      // Colorado taxable: $295,500 - $16,100 = $279,400
      const { colorado, federal } = calculateColorado({
        federalIncome: 320000,
        contributions401k: 24500,
      });

      expect(federal.adjustedGrossIncome).toBe(295500);
      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(279400);
    });
  });

  describe("the larger of the two addbacks", () => {
    it("adds back $43,000, not $43,000 plus $12,800, for a high-income itemizer", () => {
      // Married filing jointly, $400,000 of wages.
      // Federal itemized: $15,000 Colorado tax + $10,000 property tax +
      //   $20,000 mortgage interest = $45,000, against $32,200 standard
      // Federal taxable income: $400,000 - $45,000 = $355,000
      // State income tax addback: the lesser of $25,000 - $10,000 = $15,000
      //   and $45,000 - $32,200 = $12,800
      // Deduction addback: $45,000 - $2,000 = $43,000
      // The larger applies: $43,000
      // Colorado taxable: $355,000 + $43,000 = $398,000
      // Tax: 4.4% x $398,000 = $17,512
      const { colorado } = calculateColorado({
        federalIncome: 400000,
        stateTaxWithheld: 15000,
        propertyTaxesPaid: 10000,
        mortgageInterestPaid: 20000,
        filingStatus: "marriedFilingJointly",
      });

      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(355000);
      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(43000);
      expect(colorado.taxableOrdinaryIncome).toBe(398000);
      expect(colorado.totalTax).toBeCloseTo(17512, 2);
    });

    it("leaves the state income tax addback in place below $300,000 of federal AGI", () => {
      // The same deductions on $299,999 of wages: only the $12,800 applies
      // Colorado taxable: $299,999 - $45,000 + $12,800 = $267,799
      const { colorado } = calculateColorado({
        federalIncome: 299999,
        stateTaxWithheld: 15000,
        propertyTaxesPaid: 10000,
        mortgageInterestPaid: 20000,
        filingStatus: "marriedFilingJointly",
      });

      expect(colorado.coloradoAdjustments!.deductionAddback).toBe(12800);
      expect(colorado.taxableOrdinaryIncome).toBe(267799);
    });
  });

  describe("charitable subtraction for filers taking the federal standard deduction", () => {
    it("subtracts gifts over $500: $2,500 of a $3,000 gift", () => {
      // Federal taxable income: $116,100 - $16,100 = $100,000
      // Colorado taxable: $100,000 - ($3,000 - $500) = $97,500
      // Tax: 4.4% x $97,500 = $4,290
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        charitableContributions: 3000,
      });

      expect(colorado.coloradoAdjustments!.charitableSubtraction).toBe(2500);
      expect(colorado.taxableOrdinaryIncome).toBe(97500);
      expect(colorado.totalTax).toBeCloseTo(4290, 2);
    });

    it("subtracts nothing for a gift of exactly $500", () => {
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        charitableContributions: 500,
      });

      expect(colorado.coloradoAdjustments!.charitableSubtraction).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
    });

    it("subtracts $1 for a gift of $501", () => {
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        charitableContributions: 501,
      });

      expect(colorado.coloradoAdjustments!.charitableSubtraction).toBe(1);
      expect(colorado.taxableOrdinaryIncome).toBe(99999);
    });

    it("subtracts nothing for a filer who itemizes", () => {
      // Federal itemized: $20,000 mortgage interest + $5,000 of gifts less
      //   the 0.5% x $150,000 = $750 floor = $24,250, against $16,100
      // Colorado taxable: $150,000 - $24,250 = $125,750, the federal figure
      const { colorado, federal } = calculateColorado({
        federalIncome: 150000,
        mortgageInterestPaid: 20000,
        charitableContributions: 5000,
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(colorado.coloradoAdjustments!.charitableSubtraction).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(125750);
    });
  });

  describe("U.S. Treasury interest subtraction", () => {
    it("subtracts Treasury interest, which is in federal taxable income: $12,000", () => {
      // Federal taxable income: $96,100 wages + $20,000 interest - $16,100
      //   = $100,000
      // $12,000 of the interest is from Treasuries
      // Colorado taxable: $100,000 - $12,000 = $88,000
      // Tax: 4.4% x $88,000 = $3,872
      const { colorado } = calculateColorado({
        federalIncome: 96100,
        interestIncome: 20000,
        treasuryInterest: 12000,
      });

      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(100000);
      expect(colorado.coloradoAdjustments!.treasuryInterestSubtraction).toBe(
        12000,
      );
      expect(colorado.interestIncome).toBe(8000);
      expect(colorado.taxableOrdinaryIncome).toBe(88000);
      expect(colorado.totalTax).toBeCloseTo(3872, 2);
    });

    it("subtracts nothing for other interest", () => {
      const { colorado } = calculateColorado({
        federalIncome: 96100,
        interestIncome: 20000,
      });

      expect(colorado.coloradoAdjustments!.treasuryInterestSubtraction).toBe(0);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
    });
  });

  describe("taxable income is never below zero", () => {
    it("stops at $0 when the charitable subtraction exceeds federal taxable income", () => {
      // Federal taxable income: $20,000 - $16,100 = $3,900
      // Charitable subtraction: $10,000 - $500 = $9,500
      const { colorado, federal } = calculateColorado({
        federalIncome: 20000,
        charitableContributions: 10000,
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("standard");
      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(3900);
      expect(colorado.coloradoAdjustments!.charitableSubtraction).toBe(9500);
      expect(colorado.taxableOrdinaryIncome).toBe(0);
      expect(colorado.totalTax).toBe(0);
    });

    it("stops at $0 when Treasury interest exceeds federal taxable income", () => {
      // Federal taxable income: $20,000 of Treasury interest - $16,100
      //   = $3,900, less the $20,000 subtraction
      const { colorado } = calculateColorado({
        interestIncome: 20000,
        treasuryInterest: 20000,
      });

      expect(colorado.coloradoAdjustments!.federalTaxableIncome).toBe(3900);
      expect(colorado.taxableOrdinaryIncome).toBe(0);
      expect(colorado.totalTax).toBe(0);
    });
  });

  describe("safe harbor", () => {
    // $116,100 of wages: $4,400 of tax
    it("requires 70% of this year's tax: $3,080 on $4,400", () => {
      // $3,100 paid is enough for 70% ($3,080) and $3,000 is $80 short
      const paidEnough = calculateColorado({
        federalIncome: 116100,
        stateEstimatedPaid: 3100,
      }).colorado;
      const paidTooLittle = calculateColorado({
        federalIncome: 116100,
        stateEstimatedPaid: 3000,
      }).colorado;

      expect(paidEnough.safeHarbor!.currentYear90Percent).toBeCloseTo(3080, 2);
      expect(paidEnough.safeHarbor!.minimum).toBeCloseTo(3080, 2);
      expect(paidEnough.safeHarbor!.met).toBe(true);
      expect(paidTooLittle.safeHarbor!.met).toBe(false);
      expect(paidTooLittle.safeHarbor!.remaining).toBeCloseTo(80, 2);
    });

    it("accepts 100% of last year's tax when last year's income was not over $150,000: $2,000", () => {
      // The lesser of $3,080 and 100% x $2,000
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        priorYearStateTax: 2000,
        priorYearIncomeOverThreshold: false,
        stateEstimatedPaid: 2000,
      });

      expect(colorado.safeHarbor!.priorYearSafeHarbor).toBe(2000);
      expect(colorado.safeHarbor!.priorYearPercent).toBe(1);
      expect(colorado.safeHarbor!.minimum).toBe(2000);
      expect(colorado.safeHarbor!.met).toBe(true);
    });

    it("requires 110% of last year's tax when last year's income was over $150,000: $2,200", () => {
      // The lesser of $3,080 and 110% x $2,000; $2,000 paid is $200 short
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        priorYearStateTax: 2000,
        priorYearIncomeOverThreshold: true,
        stateEstimatedPaid: 2000,
      });

      expect(colorado.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(2200, 2);
      expect(colorado.safeHarbor!.priorYearPercent).toBe(1.1);
      expect(colorado.safeHarbor!.minimum).toBeCloseTo(2200, 2);
      expect(colorado.safeHarbor!.met).toBe(false);
      expect(colorado.safeHarbor!.remaining).toBeCloseTo(200, 2);
    });
  });

  describe("shared building blocks", () => {
    it("reports state wages, but still taxes federal taxable income", () => {
      // Colorado starts from the federal return, so the tax is 4.4% of
      // $116,100 - $16,100 = $100,000 whatever the state wages are
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        stateIncome: 90000,
      });

      expect(colorado.wageIncome).toBe(90000);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
      expect(colorado.totalTax).toBeCloseTo(4400, 2);
    });

    it("picks up 401(k) contributions and pre-tax medical through federal taxable income", () => {
      // $140,000 - $20,000 - $3,900 = $116,100, less $16,100 = $100,000
      const { colorado } = calculateColorado({
        federalIncome: 140000,
        contributions401k: 20000,
        preTaxMedical: 3900,
      });

      expect(colorado.contributions401k).toBe(20000);
      expect(colorado.preTaxMedical).toBe(3900);
      expect(colorado.adjustedGrossIncome).toBe(116100);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
      expect(colorado.totalTax).toBeCloseTo(4400, 2);
    });

    it("reports self-employment income and the deductible half of self-employment tax", () => {
      // Net earnings: $80,000 x 92.35% = $73,880
      // SE tax:       $73,880 x 12.4% = $9,161.12, plus $73,880 x 2.9%
      //               = $2,142.52, is $11,303.64; half is $5,651.82
      // Colorado AGI: $80,000 - $5,651.82 = $74,348.18
      // The tax starts from federal taxable income, which is also after the
      // federal deduction for business income
      const { colorado, federal } = calculateColorado({
        selfEmploymentIncome: 80000,
      });

      expect(colorado.selfEmploymentIncome).toBe(80000);
      expect(colorado.deductibleSETax).toBeCloseTo(5651.82, 2);
      expect(colorado.adjustedGrossIncome).toBeCloseTo(74348.18, 2);
      expect(colorado.taxableOrdinaryIncome).toBe(
        federal.taxableOrdinaryIncome,
      );
    });

    it("picks up a capital loss carryover through federal taxable income", () => {
      // $106,100 wages + $20,000 long-term gain - $10,000 carryover
      // = $116,100, less $16,100 = $100,000
      const { colorado } = calculateColorado({
        federalIncome: 106100,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 10000,
      });

      expect(colorado.longTermLossCarryoverOffset).toBe(10000);
      expect(colorado.taxableOrdinaryIncome).toBe(100000);
    });

    it("counts Colorado withholding and estimated payments against the tax", () => {
      // $4,400 of tax - $3,000 withheld - $1,000 estimated = $400 owed
      const { colorado } = calculateColorado({
        federalIncome: 116100,
        stateTaxWithheld: 3000,
        stateEstimatedPaid: 1000,
      });

      expect(colorado.withheld).toBe(3000);
      expect(colorado.estimatedPaid).toBe(1000);
      expect(colorado.totalPaid).toBe(4000);
      expect(colorado.remainingOwed).toBeCloseTo(400, 2);
      expect(colorado.refundDue).toBe(0);
    });
  });

  describe("zero and empty inputs", () => {
    it("owes nothing with no income", () => {
      const { colorado } = calculateColorado({});

      expect(colorado.coloradoAdjustments).toEqual({
        charitableSubtraction: 0,
        deductionAddback: 0,
        federalTaxableIncome: 0,
        treasuryInterestSubtraction: 0,
      });
      expect(colorado.taxableOrdinaryIncome).toBe(0);
      expect(colorado.totalTax).toBe(0);
      expect(colorado.remainingOwed).toBe(0);
      expect(colorado.refundDue).toBe(0);
      expect(colorado.safeHarbor!.minimum).toBe(0);
      expect(colorado.safeHarbor!.met).toBe(true);
    });

    it("reports no self-employment figures when there is no self-employment income", () => {
      const { colorado } = calculateColorado({ federalIncome: 116100 });

      expect(colorado.selfEmploymentIncome).toBeUndefined();
      expect(colorado.deductibleSETax).toBeUndefined();
    });

    it("owes nothing when income is below the federal standard deduction", () => {
      const { colorado } = calculateColorado({ federalIncome: 8000 });

      expect(colorado.taxableOrdinaryIncome).toBe(0);
      expect(colorado.totalTax).toBe(0);
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateColoradoTax - tax year %s",
  (year: TaxYear) => {
    const data = loadTestDataForYear(year);

    it("taxes $100,000 of wages for a single filer", () => {
      // 2025: $100,000 - $15,750 = $84,250; 4.4% x $84,250 = $3,707
      // 2026: $100,000 - $16,100 = $83,900; 4.4% x $83,900 = $3,691.60
      const expectedTaxable = { "2025": 84250, "2026": 83900 };
      const expectedTax = { "2025": 3707, "2026": 3691.6 };

      const { colorado } = calculateColorado({ federalIncome: 100000 }, year);

      expect(colorado.taxableOrdinaryIncome).toBe(expectedTaxable[year]);
      expect(colorado.totalTax).toBeCloseTo(expectedTax[year], 2);
    });

    it("uses the year's flat rate", () => {
      const [bracket] = data.coloradoBrackets.brackets.single;

      const { colorado } = calculateColorado(
        {
          federalIncome:
            data.federalDeductions.standardDeduction.single + 100000,
        },
        year,
      );

      expect(colorado.ordinaryIncomeBracketBreakdown[0].rate).toBe(
        bracket.rate,
      );
      expect(colorado.totalTax).toBeCloseTo(100000 * bracket.rate, 2);
    });

    it.each<{
      filingStatus: FilingStatus;
      addback: Record<TaxYear, number>;
    }>([
      // 2025: $15,750 - $12,000; 2026: $16,100 - $1,000
      { filingStatus: "single", addback: { "2025": 3750, "2026": 15100 } },
      // 2025: $31,500 - $16,000; 2026: $32,200 - $2,000
      {
        filingStatus: "marriedFilingJointly",
        addback: { "2025": 15500, "2026": 30200 },
      },
      // 2025: $15,750 - $12,000; 2026: $16,100 - $1,000
      {
        filingStatus: "marriedFilingSeparately",
        addback: { "2025": 3750, "2026": 15100 },
      },
    ])(
      "uses the year's deduction addback limit for $filingStatus",
      ({ filingStatus, addback }) => {
        const { colorado } = calculateColorado(
          { federalIncome: 400000, filingStatus },
          year,
        );

        expect(colorado.coloradoAdjustments!.deductionAddback).toBe(
          addback[year],
        );
      },
    );

    it("uses the year's AGI threshold for the deduction addback", () => {
      const { agiThreshold } = data.coloradoLimits.deductionAddback;

      const atThreshold = calculateColorado(
        { federalIncome: agiThreshold },
        year,
      ).colorado;
      const oneDollarUnder = calculateColorado(
        { federalIncome: agiThreshold - 1 },
        year,
      ).colorado;

      expect(
        atThreshold.coloradoAdjustments!.deductionAddback,
      ).toBeGreaterThan(0);
      expect(oneDollarUnder.coloradoAdjustments!.deductionAddback).toBe(0);
    });

    it("uses the year's charitable subtraction floor", () => {
      const floor = data.coloradoLimits.charitableSubtractionFloor;

      const { colorado } = calculateColorado(
        { federalIncome: 100000, charitableContributions: floor + 1000 },
        year,
      );

      expect(colorado.coloradoAdjustments!.charitableSubtraction).toBe(1000);
    });

    it("uses the year's safe harbor percentages", () => {
      const { safeHarbor } = data.coloradoLimits;

      const lowerIncome = calculateColorado(
        {
          federalIncome: 100000,
          priorYearStateTax: 10000,
          priorYearIncomeOverThreshold: false,
        },
        year,
      ).colorado;
      const higherIncome = calculateColorado(
        {
          federalIncome: 100000,
          priorYearStateTax: 10000,
          priorYearIncomeOverThreshold: true,
        },
        year,
      ).colorado;

      expect(lowerIncome.safeHarbor!.currentYear90Percent).toBeCloseTo(
        lowerIncome.totalTax * safeHarbor.currentYearPercent,
        2,
      );
      expect(lowerIncome.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(
        10000 * safeHarbor.priorYearPercent,
        2,
      );
      expect(higherIncome.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(
        10000 * safeHarbor.highIncomePriorYearPercent,
        2,
      );
    });
  },
);
