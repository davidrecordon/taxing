import { describe, it, expect, beforeAll } from "vitest";
import { calculateFederalTax } from "../federalTaxCalculator";
import { calculateDCTax } from "../states/dcTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import { FilingStatus, TaxInputs } from "../types";
import {
  dcBrackets,
  dcDeductions,
  dcLimits,
  sharedLimits,
  federalBrackets,
  federalDeductions,
  federalLimits,
  ltcgBrackets,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

// Run the federal return first and hand its deduction to DC, as the app does.
// The filer is single unless the test says otherwise.
function calculateDC(overrides: Partial<TaxInputs>) {
  const inputs = createDefaultInputs({ selectedState: "dc", ...overrides });
  const federal = calculateFederalTax(
    inputs,
    federalBrackets,
    ltcgBrackets,
    federalDeductions,
    sharedLimits,
    federalLimits,
    ficaData,
  );
  const dc = calculateDCTax(
    inputs,
    dcBrackets,
    dcDeductions,
    sharedLimits,
    federalLimits,
    dcLimits,
    ficaData,
    federal.deductionBreakdown,
  );
  return { dc, federal };
}

// The DC schedule, with the tax owed at the top of each bracket:
//   4%     on $0 - $10,000              $400
//   6%     on $10,000 - $40,000         $400 + $1,800 = $2,200
//   6.5%   on $40,000 - $60,000         $2,200 + $1,300 = $3,500
//   8.5%   on $60,000 - $250,000        $3,500 + $16,150 = $19,650
//   9.25%  on $250,000 - $500,000       $19,650 + $23,125 = $42,775
//   9.75%  on $500,000 - $1,000,000     $42,775 + $48,750 = $91,525
//   10.75% above $1,000,000
// The standard deduction is $16,100 ($32,200 married filing jointly), so
// wages of $116,100 leave a single filer $100,000 of taxable income and
// $3,500 + 8.5% x $40,000 = $6,900 of tax. Many tests below use that figure.
const STANDARD_DEDUCTION = 16100;

describe("calculateDCTax", () => {
  describe("worked examples", () => {
    it("single filer taking the standard deduction: $100,000 of wages and a $10,000 long-term gain", () => {
      // Income:   $100,000 + $10,000 = $110,000 (the gain is ordinary income)
      // Federal:  $6,000 of DC tax is the only itemized deduction, so the
      //           federal return takes the standard deduction and DC must too
      // Taxable:  $110,000 - $16,100 = $93,900
      // Tax:      $3,500 + 8.5% x ($93,900 - $60,000) = $3,500 + $2,881.50
      //           = $6,381.50
      // Owed:     $6,381.50 - $6,000 withheld = $381.50
      // Safe harbor: the lesser of 90% x $6,381.50 = $5,743.35 and
      //           110% x $5,000 = $5,500; $6,000 paid meets it
      const { dc, federal } = calculateDC({
        federalIncome: 100000,
        longTermCapitalGains: 10000,
        stateTaxWithheld: 6000,
        priorYearStateTax: 5000,
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("standard");
      expect(dc.grossIncome).toBe(110000);
      expect(dc.adjustedGrossIncome).toBe(110000);
      expect(dc.deductionBreakdown.deductionUsed).toBe("standard");
      expect(dc.deductionBreakdown.deductionAmount).toBe(16100);
      expect(dc.taxableOrdinaryIncome).toBe(93900);
      expect(dc.totalTax).toBeCloseTo(6381.5, 2);
      expect(dc.remainingOwed).toBeCloseTo(381.5, 2);
      expect(dc.refundDue).toBe(0);
      expect(dc.safeHarbor!.currentYear90Percent).toBeCloseTo(5743.35, 2);
      expect(dc.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5500, 2);
      expect(dc.safeHarbor!.minimum).toBeCloseTo(5500, 2);
      expect(dc.safeHarbor!.met).toBe(true);
    });

    it("married couple itemizing: $300,000 of wages, a mortgage, property tax and gifts", () => {
      // Federal:  $20,000 DC tax + $12,000 property tax = $32,000 (under the
      //           cap), $25,000 mortgage interest, and $6,500 of gifts less
      //           the 0.5% x $300,000 = $1,500 floor = $5,000.
      //           $62,000 beats the $32,200 standard deduction, so the
      //           federal return itemizes and DC must too.
      // DC:       $12,000 + $25,000 + $5,000 = $42,000 (no DC income tax),
      //           less 5% x ($300,000 - $200,000) = $5,000, leaves $37,000
      // Taxable:  $300,000 - $37,000 = $263,000
      // Tax:      $19,650 + 9.25% x ($263,000 - $250,000) = $19,650 +
      //           $1,202.50 = $20,852.50
      // Owed:     $20,852.50 - $20,000 withheld = $852.50
      const { dc, federal } = calculateDC({
        federalIncome: 300000,
        stateTaxWithheld: 20000,
        propertyTaxesPaid: 12000,
        mortgageInterestPaid: 25000,
        charitableContributions: 6500,
        filingStatus: "marriedFilingJointly",
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(federal.deductionBreakdown.deductionAmount).toBe(62000);
      expect(dc.adjustedGrossIncome).toBe(300000);
      expect(dc.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(dc.deductionBreakdown.propertyTax).toBe(12000);
      expect(dc.deductionBreakdown.saltDeduction).toBe(0);
      expect(dc.deductionBreakdown.mortgageInterest).toBe(25000);
      expect(dc.deductionBreakdown.charitableContributions).toBe(5000);
      expect(dc.deductionBreakdown.highIncomeReduction).toBe(5000);
      expect(dc.deductionBreakdown.deductionAmount).toBe(37000);
      expect(dc.taxableOrdinaryIncome).toBe(263000);
      expect(dc.totalTax).toBeCloseTo(20852.5, 2);
      expect(dc.remainingOwed).toBeCloseTo(852.5, 2);
    });

    it("married couple taking the standard deduction: wages, interest, dividends and a short-term gain", () => {
      // Income:   $200,000 wages + $6,000 interest ($10,000 less $4,000 from
      //           U.S. Treasuries) + $6,000 dividends + $20,200 short-term
      //           gain = $232,200
      // Taxable:  $232,200 - $32,200 = $200,000
      // Tax:      $3,500 + 8.5% x ($200,000 - $60,000) = $3,500 + $11,900
      //           = $15,400
      // Refund:   $16,000 of estimated payments - $15,400 = $600
      const { dc } = calculateDC({
        federalIncome: 200000,
        interestIncome: 10000,
        treasuryInterest: 4000,
        ordinaryDividends: 6000,
        qualifiedDividends: 6000,
        shortTermCapitalGains: 20200,
        stateEstimatedPaid: 16000,
        filingStatus: "marriedFilingJointly",
      });

      expect(dc.grossIncome).toBe(232200);
      expect(dc.deductionBreakdown.deductionAmount).toBe(32200);
      expect(dc.taxableOrdinaryIncome).toBe(200000);
      expect(dc.totalTax).toBeCloseTo(15400, 2);
      expect(dc.remainingOwed).toBe(0);
      expect(dc.refundDue).toBeCloseTo(600, 2);
    });
  });

  describe("rate schedule", () => {
    it.each([
      // $5,000 x 4%
      { rate: "4%", taxable: 5000, tax: 200 },
      // $400 + $15,000 x 6% = $400 + $900
      { rate: "6%", taxable: 25000, tax: 1300 },
      // $2,200 + $10,000 x 6.5% = $2,200 + $650
      { rate: "6.5%", taxable: 50000, tax: 2850 },
      // $3,500 + $40,000 x 8.5% = $3,500 + $3,400
      { rate: "8.5%", taxable: 100000, tax: 6900 },
      // $19,650 + $50,000 x 9.25% = $19,650 + $4,625
      { rate: "9.25%", taxable: 300000, tax: 24275 },
      // $42,775 + $100,000 x 9.75% = $42,775 + $9,750
      { rate: "9.75%", taxable: 600000, tax: 52525 },
      // $91,525 + $1,000,000 x 10.75% = $91,525 + $107,500
      { rate: "10.75%", taxable: 2000000, tax: 199025 },
    ])(
      "taxes taxable income of $taxable at up to $rate: tax of $tax",
      ({ taxable, tax }) => {
        const { dc } = calculateDC({
          federalIncome: taxable + STANDARD_DEDUCTION,
        });

        expect(dc.taxableOrdinaryIncome).toBe(taxable);
        expect(dc.ordinaryIncomeTax).toBeCloseTo(tax, 2);
        expect(dc.totalTax).toBeCloseTo(tax, 2);
      },
    );

    // The extra dollar is taxed at the next rate. The difference between two
    // neighbouring rates on one dollar is a fraction of a cent, so these
    // compare to four decimal places.
    it.each([
      { boundary: 10000, taxAt: 400, nextRate: "6%", taxOver: 400.06 },
      { boundary: 40000, taxAt: 2200, nextRate: "6.5%", taxOver: 2200.065 },
      { boundary: 60000, taxAt: 3500, nextRate: "8.5%", taxOver: 3500.085 },
      {
        boundary: 250000,
        taxAt: 19650,
        nextRate: "9.25%",
        taxOver: 19650.0925,
      },
      {
        boundary: 500000,
        taxAt: 42775,
        nextRate: "9.75%",
        taxOver: 42775.0975,
      },
      {
        boundary: 1000000,
        taxAt: 91525,
        nextRate: "10.75%",
        taxOver: 91525.1075,
      },
    ])(
      "owes $taxAt at taxable income of $boundary, and $nextRate on the next dollar",
      ({ boundary, taxAt, taxOver }) => {
        const atBoundary = calculateDC({
          federalIncome: boundary + STANDARD_DEDUCTION,
        }).dc;
        const oneDollarOver = calculateDC({
          federalIncome: boundary + 1 + STANDARD_DEDUCTION,
        }).dc;

        expect(atBoundary.taxableOrdinaryIncome).toBe(boundary);
        expect(atBoundary.totalTax).toBeCloseTo(taxAt, 4);
        expect(oneDollarOver.taxableOrdinaryIncome).toBe(boundary + 1);
        expect(oneDollarOver.totalTax).toBeCloseTo(taxOver, 4);
      },
    );

    // Wages are the standard deduction for the filing status plus $600,000,
    // an income at which the federal schedules differ by filing status.
    // $42,775 + 9.75% x $100,000 = $52,525
    it.each<{ filingStatus: FilingStatus; wages: number }>([
      { filingStatus: "single", wages: 616100 },
      { filingStatus: "marriedFilingJointly", wages: 632200 },
      { filingStatus: "marriedFilingSeparately", wages: 616100 },
    ])(
      "uses the one schedule for $filingStatus (52,525 on 600,000 of taxable income)",
      ({ filingStatus, wages }) => {
        const { dc } = calculateDC({ federalIncome: wages, filingStatus });

        expect(dc.taxableOrdinaryIncome).toBe(600000);
        expect(dc.totalTax).toBeCloseTo(52525, 2);
      },
    );
  });

  describe("all income is ordinary income", () => {
    // Each return has $116,100 of income, so $100,000 of taxable income and
    // $6,900 of tax, the same as $116,100 of wages.
    it.each<{ kind: string; income: Partial<TaxInputs> }>([
      {
        kind: "long-term capital gains",
        income: { federalIncome: 66100, longTermCapitalGains: 50000 },
      },
      {
        kind: "short-term capital gains",
        income: { federalIncome: 66100, shortTermCapitalGains: 50000 },
      },
      {
        kind: "interest",
        income: { federalIncome: 106100, interestIncome: 10000 },
      },
      {
        kind: "qualified dividends",
        income: {
          federalIncome: 106100,
          ordinaryDividends: 10000,
          qualifiedDividends: 10000,
        },
      },
    ])("taxes $kind on the ordinary schedule", ({ income }) => {
      const { dc } = calculateDC(income);

      expect(dc.grossIncome).toBe(116100);
      expect(dc.taxableOrdinaryIncome).toBe(100000);
      expect(dc.taxableLTCG).toBe(0);
      expect(dc.ordinaryIncomeTax).toBeCloseTo(6900, 2);
      expect(dc.ltcgTax).toBe(0);
      expect(dc.ltcgBracketBreakdown).toEqual([]);
      expect(dc.totalTax).toBeCloseTo(6900, 2);
    });

    it("leaves U.S. Treasury interest out of DC income", () => {
      // $116,100 wages + $10,000 interest, $4,000 of it from Treasuries
      // Income:  $116,100 + $6,000 = $122,100
      // Taxable: $122,100 - $16,100 = $106,000
      // Tax:     $3,500 + 8.5% x $46,000 = $3,500 + $3,910 = $7,410
      const { dc, federal } = calculateDC({
        federalIncome: 116100,
        interestIncome: 10000,
        treasuryInterest: 4000,
      });

      expect(federal.adjustedGrossIncome).toBe(126100);
      expect(dc.interestIncome).toBe(6000);
      expect(dc.grossIncome).toBe(122100);
      expect(dc.taxableOrdinaryIncome).toBe(106000);
      expect(dc.totalTax).toBeCloseTo(7410, 2);
    });
  });

  describe("same type of deduction as the federal return", () => {
    it("itemizes when the federal return itemizes, even below the $16,100 DC standard deduction", () => {
      // Federal: $9,500 DC tax + $6,000 property tax + $5,000 mortgage
      //          interest + $250 of gifts ($1,000 less the 0.5% x $150,000
      //          floor) = $20,750, which beats the $16,100 standard deduction
      // DC:      $6,000 + $5,000 + $250 = $11,250 (no DC income tax). That is
      //          less than $16,100, but DC must itemize as well.
      // Taxable: $150,000 - $11,250 = $138,750
      // Tax:     $3,500 + 8.5% x $78,750 = $3,500 + $6,693.75 = $10,193.75
      const { dc, federal } = calculateDC({
        federalIncome: 150000,
        stateTaxWithheld: 9500,
        propertyTaxesPaid: 6000,
        mortgageInterestPaid: 5000,
        charitableContributions: 1000,
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(federal.deductionBreakdown.deductionAmount).toBe(20750);
      expect(dc.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(dc.deductionBreakdown.deductionAmount).toBe(11250);
      expect(dc.deductionBreakdown.followsFederalChoice).toBe(true);
      expect(dc.taxableOrdinaryIncome).toBe(138750);
      expect(dc.totalTax).toBeCloseTo(10193.75, 2);
    });

    it("takes the $32,200 standard deduction when the federal return does, even when DC itemized deductions are larger", () => {
      // Married filing jointly, $650,000 of wages, $60,000 of property tax.
      // Federal: at this income the cap on state and local taxes is down to
      //          $10,000, less than the $32,200 standard deduction, so the
      //          federal return takes the standard deduction
      // DC:      itemizing would give $60,000 - 5% x ($650,000 - $200,000)
      //          = $37,500, more than $32,200, but DC must take the standard
      //          deduction as well
      // Taxable: $650,000 - $32,200 = $617,800
      // Tax:     $42,775 + 9.75% x $117,800 = $42,775 + $11,485.50
      //          = $54,260.50
      const { dc, federal } = calculateDC({
        federalIncome: 650000,
        propertyTaxesPaid: 60000,
        filingStatus: "marriedFilingJointly",
      });

      expect(federal.deductionBreakdown.deductionUsed).toBe("standard");
      expect(dc.deductionBreakdown.itemizedDeduction).toBe(37500);
      expect(dc.deductionBreakdown.deductionUsed).toBe("standard");
      expect(dc.deductionBreakdown.deductionAmount).toBe(32200);
      expect(dc.deductionBreakdown.followsFederalChoice).toBe(true);
      expect(dc.taxableOrdinaryIncome).toBe(617800);
      expect(dc.totalTax).toBeCloseTo(54260.5, 2);
    });
  });

  describe("safe harbor", () => {
    // $116,100 of wages: $6,900 of tax
    it("requires 90% of this year's tax: $6,210 on $6,900", () => {
      // $6,300 paid is enough for 90% ($6,210) and $6,200 is $10 short
      const paidEnough = calculateDC({
        federalIncome: 116100,
        stateEstimatedPaid: 6300,
      }).dc;
      const paidTooLittle = calculateDC({
        federalIncome: 116100,
        stateEstimatedPaid: 6200,
      }).dc;

      expect(paidEnough.safeHarbor!.currentYear90Percent).toBeCloseTo(6210, 2);
      expect(paidEnough.safeHarbor!.minimum).toBeCloseTo(6210, 2);
      expect(paidEnough.safeHarbor!.met).toBe(true);
      expect(paidTooLittle.safeHarbor!.met).toBe(false);
      expect(paidTooLittle.safeHarbor!.remaining).toBeCloseTo(10, 2);
    });

    it("accepts 110% of last year's tax instead: $5,500 on $5,000", () => {
      // The lesser of $6,210 and 110% x $5,000 = $5,500
      const { dc } = calculateDC({
        federalIncome: 116100,
        priorYearStateTax: 5000,
        stateEstimatedPaid: 5600,
      });

      expect(dc.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5500, 2);
      expect(dc.safeHarbor!.priorYearPercent).toBe(1.1);
      expect(dc.safeHarbor!.minimum).toBeCloseTo(5500, 2);
      expect(dc.safeHarbor!.met).toBe(true);
    });

    // Unlike the federal rule, DC has no lower share for lower incomes. The
    // cases are the answer to whether last year's income was over $150,000.
    it.each([true, false, undefined])(
      "requires 110% of last year's tax whatever last year's income was (over the threshold: %s)",
      (priorYearIncomeOverThreshold) => {
        const { dc } = calculateDC({
          federalIncome: 116100,
          priorYearStateTax: 5000,
          priorYearIncomeOverThreshold,
        });

        expect(dc.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5500, 2);
      },
    );
  });

  describe("shared building blocks", () => {
    it("taxes DC wages when they differ from federal wages", () => {
      // $96,100 of DC wages - $16,100 = $80,000 taxable
      // Tax: $3,500 + 8.5% x $20,000 = $5,200
      const { dc } = calculateDC({
        federalIncome: 120000,
        stateIncome: 96100,
      });

      expect(dc.wageIncome).toBe(96100);
      expect(dc.taxableOrdinaryIncome).toBe(80000);
      expect(dc.totalTax).toBeCloseTo(5200, 2);
    });

    it("subtracts 401(k) contributions and pre-tax medical from income", () => {
      // $140,000 - $20,000 - $3,900 = $116,100, less $16,100 = $100,000
      const { dc } = calculateDC({
        federalIncome: 140000,
        contributions401k: 20000,
        preTaxMedical: 3900,
      });

      expect(dc.grossIncome).toBe(140000);
      expect(dc.adjustedGrossIncome).toBe(116100);
      expect(dc.taxableOrdinaryIncome).toBe(100000);
      expect(dc.totalTax).toBeCloseTo(6900, 2);
    });

    it("taxes self-employment income less the deductible half of self-employment tax", () => {
      // Net earnings: $80,000 x 92.35% = $73,880
      // SE tax:       $73,880 x 12.4% = $9,161.12, plus $73,880 x 2.9%
      //               = $2,142.52, is $11,303.64; half is $5,651.82
      // Taxable:      $80,000 - $5,651.82 - $16,100 = $58,248.18
      // Tax:          $2,200 + 6.5% x $18,248.18 = $2,200 + $1,186.13
      //               = $3,386.13
      const { dc } = calculateDC({ selfEmploymentIncome: 80000 });

      expect(dc.selfEmploymentIncome).toBe(80000);
      expect(dc.grossIncome).toBe(80000);
      expect(dc.deductibleSETax).toBeCloseTo(5651.82, 2);
      expect(dc.taxableOrdinaryIncome).toBeCloseTo(58248.18, 2);
      expect(dc.totalTax).toBeCloseTo(3386.13, 2);
    });

    it("nets a capital loss carryover against gains before taxing them", () => {
      // $106,100 wages + $20,000 long-term gain - $10,000 carryover
      // = $116,100, less $16,100 = $100,000
      const { dc } = calculateDC({
        federalIncome: 106100,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 10000,
      });

      expect(dc.longTermLossCarryoverOffset).toBe(10000);
      expect(dc.adjustedGrossIncome).toBe(116100);
      expect(dc.taxableOrdinaryIncome).toBe(100000);
    });

    it("counts DC withholding and estimated payments against the tax", () => {
      // $6,900 of tax - $5,000 withheld - $1,000 estimated = $900 owed
      const { dc } = calculateDC({
        federalIncome: 116100,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 1000,
      });

      expect(dc.withheld).toBe(5000);
      expect(dc.estimatedPaid).toBe(1000);
      expect(dc.totalPaid).toBe(6000);
      expect(dc.remainingOwed).toBeCloseTo(900, 2);
      expect(dc.refundDue).toBe(0);
    });
  });

  describe("zero and empty inputs", () => {
    it("owes nothing with no income", () => {
      const { dc } = calculateDC({});

      expect(dc.grossIncome).toBe(0);
      expect(dc.adjustedGrossIncome).toBe(0);
      expect(dc.taxableOrdinaryIncome).toBe(0);
      expect(dc.totalTax).toBe(0);
      expect(dc.remainingOwed).toBe(0);
      expect(dc.refundDue).toBe(0);
      expect(dc.safeHarbor!.minimum).toBe(0);
      expect(dc.safeHarbor!.met).toBe(true);
    });

    it("reports no self-employment figures when there is no self-employment income", () => {
      const { dc } = calculateDC({ federalIncome: 116100 });

      expect(dc.selfEmploymentIncome).toBeUndefined();
      expect(dc.deductibleSETax).toBeUndefined();
    });

    it("owes nothing when income is below the standard deduction", () => {
      // $8,000 - $16,100 is below zero, so taxable income is $0
      const { dc } = calculateDC({ federalIncome: 8000 });

      expect(dc.taxableOrdinaryIncome).toBe(0);
      expect(dc.totalTax).toBe(0);
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateDCTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    const calculateForYear = (overrides: Partial<TaxInputs>) =>
      calculateDCTax(
        createDefaultInputs({
          selectedState: "dc",
          taxYear: year,
          ...overrides,
        }),
        data.dcBrackets,
        data.dcDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.dcLimits,
        data.ficaData,
      );

    it.each<{
      filingStatus: FilingStatus;
      standardDeduction: Record<TaxYear, number>;
    }>([
      {
        filingStatus: "single",
        standardDeduction: { "2025": 15000, "2026": 16100 },
      },
      {
        filingStatus: "marriedFilingJointly",
        standardDeduction: { "2025": 30000, "2026": 32200 },
      },
      {
        filingStatus: "marriedFilingSeparately",
        standardDeduction: { "2025": 15000, "2026": 16100 },
      },
    ])(
      "uses the year's standard deduction for $filingStatus",
      ({ filingStatus, standardDeduction }) => {
        const result = calculateForYear({
          federalIncome: 100000,
          filingStatus,
        });

        expect(result.deductionBreakdown.standardDeduction).toBe(
          standardDeduction[year],
        );
        expect(result.taxableOrdinaryIncome).toBe(
          100000 - standardDeduction[year],
        );
      },
    );

    it("taxes $100,000 of wages for a single filer", () => {
      // 2025: $100,000 - $15,000 = $85,000; $3,500 + 8.5% x $25,000 = $5,625
      // 2026: $100,000 - $16,100 = $83,900; $3,500 + 8.5% x $23,900
      //       = $5,531.50
      const expectedTax = { "2025": 5625, "2026": 5531.5 };

      const result = calculateForYear({ federalIncome: 100000 });

      expect(result.totalTax).toBeCloseTo(expectedTax[year], 2);
    });

    it("uses the year's rate schedule", () => {
      // Taxable income of $100,000 past the start of the top bracket
      const brackets = data.dcBrackets.brackets.single;
      const topBracket = brackets[brackets.length - 1];
      const taxBelowTopBracket = brackets
        .slice(0, -1)
        .reduce(
          (sum, bracket) => sum + (bracket.max! - bracket.min) * bracket.rate,
          0,
        );

      const result = calculateForYear({
        federalIncome:
          data.dcDeductions.standardDeduction.single +
          topBracket.min +
          100000,
      });

      expect(result.totalTax).toBeCloseTo(
        taxBelowTopBracket + 100000 * topBracket.rate,
        2,
      );
    });

    it("uses the year's safe harbor percentages", () => {
      const result = calculateForYear({
        federalIncome: 100000,
        priorYearStateTax: 10000,
      });

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        result.totalTax * data.dcLimits.safeHarbor.currentYearPercent,
        2,
      );
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(
        10000 * data.dcLimits.safeHarbor.priorYearPercent,
        2,
      );
    });
  },
);
