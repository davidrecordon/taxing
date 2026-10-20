import { describe, it, expect, beforeAll } from "vitest";
import { calculateIllinoisTax } from "../states/illinoisTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import { TaxInputs } from "../types";
import {
  illinoisBrackets,
  illinoisDeductions,
  sharedLimits,
  illinoisLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

// Figures for the default tax year (2026):
//   rate 4.95% of net income
//   personal exemption $2,925 ($5,850 married filing jointly)
//   no exemption and no property tax credit when AGI is over $250,000
//   ($500,000 married filing jointly)
// Most tests use wages ending in 2,925 or 5,850 so that net income, and so the
// tax, is a round number.
const calculate = (overrides: Partial<TaxInputs> = {}) =>
  calculateIllinoisTax(
    createDefaultInputs({ selectedState: "illinois", ...overrides }),
    illinoisBrackets,
    illinoisDeductions,
    sharedLimits,
    illinoisLimits,
    ficaData,
  );

describe("calculateIllinoisTax", () => {
  describe("worked examples", () => {
    it("single: wages, interest, dividends, gains and a home", () => {
      // Wages                               $80,425
      // Interest $2,000 less $500 Treasury   $1,500
      // Dividends                            $1,000
      // Short-term gains                     $5,000
      // Long-term gains                     $10,000
      // Gross income and AGI                $97,925
      // Personal exemption                  -$2,925
      // Net income                          $95,000
      // Tax: $95,000 x 4.95%              $4,702.50
      // Property tax credit: $4,000 x 5%   -$200.00
      // Total tax                         $4,502.50
      // Withheld                         -$4,000.00
      // Owed                                $502.50
      const result = calculate({
        federalIncome: 80425,
        interestIncome: 2000,
        treasuryInterest: 500,
        ordinaryDividends: 1000,
        shortTermCapitalGains: 5000,
        longTermCapitalGains: 10000,
        propertyTaxesPaid: 4000,
        stateTaxWithheld: 4000,
      });

      expect(result.grossIncome).toBe(97925);
      expect(result.adjustedGrossIncome).toBe(97925);
      expect(result.deductionBreakdown.deductionAmount).toBe(2925);
      expect(result.taxableOrdinaryIncome).toBe(95000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4702.5, 2);
      expect(result.propertyTaxCredit).toBeCloseTo(200, 2);
      expect(result.totalTax).toBeCloseTo(4502.5, 2);
      expect(result.remainingOwed).toBeCloseTo(502.5, 2);
      expect(result.refundDue).toBe(0);
    });

    it("married filing jointly: wages and a home, overpaid", () => {
      // Wages, gross income and AGI        $155,850
      // Personal exemption                  -$5,850
      // Net income                         $150,000
      // Tax: $150,000 x 4.95%             $7,425.00
      // Property tax credit: $8,000 x 5%   -$400.00
      // Total tax                         $7,025.00
      // Paid: $5,000 withheld + $2,500 estimated = $7,500
      // Refund: $7,500 - $7,025             $475.00
      const result = calculate({
        federalIncome: 155850,
        filingStatus: "marriedFilingJointly",
        propertyTaxesPaid: 8000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 2500,
      });

      expect(result.adjustedGrossIncome).toBe(155850);
      expect(result.deductionBreakdown.deductionAmount).toBe(5850);
      expect(result.taxableOrdinaryIncome).toBe(150000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(7425, 2);
      expect(result.propertyTaxCredit).toBeCloseTo(400, 2);
      expect(result.totalTax).toBeCloseTo(7025, 2);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBeCloseTo(475, 2);
    });

    it("married filing separately: income over the limit loses the exemption and the credit", () => {
      // Wages                              $300,000
      // Long-term gains                     $50,000
      // Gross income and AGI               $350,000  (over $250,000)
      // Personal exemption                       $0
      // Net income                         $350,000
      // Tax: $350,000 x 4.95%            $17,325.00
      // Property tax credit ($10,000 paid)    $0.00
      // Total tax and owed               $17,325.00
      const result = calculate({
        federalIncome: 300000,
        longTermCapitalGains: 50000,
        filingStatus: "marriedFilingSeparately",
        propertyTaxesPaid: 10000,
      });

      expect(result.adjustedGrossIncome).toBe(350000);
      expect(result.deductionBreakdown.deductionAmount).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(350000);
      expect(result.propertyTaxCredit).toBe(0);
      expect(result.totalTax).toBeCloseTo(17325, 2);
      expect(result.remainingOwed).toBeCloseTo(17325, 2);
    });
  });

  describe("flat rate", () => {
    it("taxes $100,000 of net income at 4.95%", () => {
      // $102,925 - $2,925 = $100,000 x 4.95% = $4,950
      const result = calculate({ federalIncome: 102925 });

      expect(result.taxableOrdinaryIncome).toBe(100000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4950, 2);
      expect(result.totalTax).toBeCloseTo(4950, 2);
    });

    it("applies the same 4.95% to $400,000 of net income", () => {
      // $405,850 - $5,850 = $400,000 x 4.95% = $19,800
      const result = calculate({
        federalIncome: 405850,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.taxableOrdinaryIncome).toBe(400000);
      expect(result.totalTax).toBeCloseTo(19800, 2);
      expect(result.ordinaryIncomeBracketBreakdown).toHaveLength(1);
      expect(result.ordinaryIncomeBracketBreakdown[0].rate).toBe(0.0495);
    });
  });

  describe("personal exemption", () => {
    it.each([
      ["single", 2925],
      ["marriedFilingJointly", 5850],
      ["marriedFilingSeparately", 2925],
    ] as const)(
      "%s: subtracts $%i from $100,000 of income",
      (filingStatus, exemption) => {
        // single and separate: $100,000 - $2,925 = $97,075
        // joint:               $100,000 - $5,850 = $94,150
        const result = calculate({ federalIncome: 100000, filingStatus });

        expect(result.deductionBreakdown.deductionAmount).toBe(exemption);
        expect(result.taxableOrdinaryIncome).toBe(100000 - exemption);
      },
    );

    it("gives zero tax, not a negative tax, when income is below the $2,925 exemption", () => {
      // $2,000 - $2,925 = -$925, floored at $0
      const result = calculate({ federalIncome: 2000 });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.refundDue).toBe(0);
    });

    it("gives zero tax when income is exactly the $2,925 exemption", () => {
      const result = calculate({ federalIncome: 2925 });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("taxes the first dollar over the $2,925 exemption", () => {
      // $2,926 - $2,925 = $1 x 4.95% = $0.0495
      const result = calculate({ federalIncome: 2926 });

      expect(result.taxableOrdinaryIncome).toBe(1);
      expect(result.totalTax).toBeCloseTo(0.0495, 4);
    });
  });

  describe("exemption income limit", () => {
    it.each([
      ["single", 250000, 2925],
      ["marriedFilingJointly", 500000, 5850],
      ["marriedFilingSeparately", 250000, 2925],
    ] as const)(
      "%s: keeps the exemption at exactly $%i of AGI",
      (filingStatus, limit, exemption) => {
        // single and separate: $250,000 - $2,925 = $247,075
        // joint:               $500,000 - $5,850 = $494,150
        const result = calculate({ federalIncome: limit, filingStatus });

        expect(result.deductionBreakdown.deductionAmount).toBe(exemption);
        expect(result.taxableOrdinaryIncome).toBe(limit - exemption);
      },
    );

    it.each([
      ["single", 250001, 12375.0495],
      ["marriedFilingJointly", 500001, 24750.0495],
      ["marriedFilingSeparately", 250001, 12375.0495],
    ] as const)(
      "%s: allows no exemption at $%i of AGI, one dollar over the limit",
      (filingStatus, income, tax) => {
        // single and separate: $250,001 x 4.95% = $12,375.0495
        // joint:               $500,001 x 4.95% = $24,750.0495
        const result = calculate({ federalIncome: income, filingStatus });

        expect(result.deductionBreakdown.deductionAmount).toBe(0);
        expect(result.taxableOrdinaryIncome).toBe(income);
        expect(result.totalTax).toBeCloseTo(tax, 2);
      },
    );

    it("measures the limit on AGI, after 401(k) contributions, not on gross income", () => {
      // $260,000 wages - $10,000 401(k) = $250,000 AGI: at the limit
      // $250,000 - $2,925 = $247,075
      const result = calculate({
        federalIncome: 260000,
        contributions401k: 10000,
      });

      expect(result.adjustedGrossIncome).toBe(250000);
      expect(result.deductionBreakdown.deductionAmount).toBe(2925);
      expect(result.taxableOrdinaryIncome).toBe(247075);
    });

    it("allows no exemption when AGI after 401(k) contributions is $250,001", () => {
      // $260,000 wages - $9,999 401(k) = $250,001 AGI: one dollar over
      const result = calculate({
        federalIncome: 260000,
        contributions401k: 9999,
      });

      expect(result.adjustedGrossIncome).toBe(250001);
      expect(result.deductionBreakdown.deductionAmount).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(250001);
    });
  });

  describe("income limit measured on federal AGI", () => {
    // The app passes the federal AGI in. It can be higher than Illinois
    // income: it includes U.S. Treasury interest, and the wages entered for
    // Illinois may be lower than the federal wages.
    const calculateWithFederalAgi = (
      federalAgi: number,
      overrides: Partial<TaxInputs>,
    ) =>
      calculateIllinoisTax(
        createDefaultInputs({ selectedState: "illinois", ...overrides }),
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits,
        ficaData,
        federalAgi,
      );

    it("loses the exemption when Treasury interest puts federal AGI over $250,000", () => {
      // Illinois income is $240,000 (the $20,000 of Treasury interest is not
      // taxed), but federal AGI is $260,000: $240,000 x 4.95% = $11,880
      const result = calculateWithFederalAgi(260000, {
        federalIncome: 240000,
        interestIncome: 20000,
        treasuryInterest: 20000,
      });

      expect(result.adjustedGrossIncome).toBe(240000);
      expect(result.deductionBreakdown.deductionAmount).toBe(0);
      expect(result.totalTax).toBeCloseTo(11880, 2);
    });

    it("keeps the exemption at exactly $250,000 of federal AGI", () => {
      // ($240,000 - $2,925) x 4.95% = $11,735.2125
      const result = calculateWithFederalAgi(250000, {
        federalIncome: 240000,
        interestIncome: 10000,
        treasuryInterest: 10000,
      });

      expect(result.deductionBreakdown.deductionAmount).toBe(2925);
      expect(result.totalTax).toBeCloseTo(11735.2125, 2);
    });

    it("loses the exemption and the credit when federal wages are over the limit and Illinois wages are not", () => {
      // $100,000 of Illinois wages x 4.95% = $4,950, with no exemption and
      // no credit for the $4,000 of property tax
      const result = calculateWithFederalAgi(300000, {
        federalIncome: 300000,
        stateIncome: 100000,
        propertyTaxesPaid: 4000,
      });

      expect(result.deductionBreakdown.deductionAmount).toBe(0);
      expect(result.propertyTaxCredit).toBe(0);
      expect(result.totalTax).toBeCloseTo(4950, 2);
    });

    it("uses Illinois AGI when the federal figure is not supplied", () => {
      // ($100,000 - $2,925) x 4.95% = $4,805.2125
      const result = calculate({ federalIncome: 300000, stateIncome: 100000 });

      expect(result.deductionBreakdown.deductionAmount).toBe(2925);
      expect(result.totalTax).toBeCloseTo(4805.2125, 2);
    });
  });

  describe("property tax credit", () => {
    it("credits 5% of property tax paid", () => {
      // Tax: ($102,925 - $2,925) x 4.95% = $4,950
      // Credit: $6,000 x 5% = $300
      // Total: $4,950 - $300 = $4,650
      const result = calculate({
        federalIncome: 102925,
        propertyTaxesPaid: 6000,
      });

      expect(result.ordinaryIncomeTax).toBeCloseTo(4950, 2);
      expect(result.propertyTaxCredit).toBeCloseTo(300, 2);
      expect(result.totalTax).toBeCloseTo(4650, 2);
    });

    it("limits the credit to the tax, so it is never refunded", () => {
      // Tax: ($12,925 - $2,925) x 4.95% = $495
      // Credit: $10,000 x 5% = $500, limited to $495
      const result = calculate({
        federalIncome: 12925,
        propertyTaxesPaid: 10000,
      });

      expect(result.propertyTaxCredit).toBeCloseTo(495, 2);
      expect(result.totalTax).toBe(0);
      expect(result.refundDue).toBe(0);
    });

    it.each([
      ["single", 250000],
      ["marriedFilingJointly", 500000],
      ["marriedFilingSeparately", 250000],
    ] as const)(
      "%s: allows the credit at exactly $%i of AGI",
      (filingStatus, limit) => {
        // $10,000 x 5% = $500
        const result = calculate({
          federalIncome: limit,
          filingStatus,
          propertyTaxesPaid: 10000,
        });

        expect(result.propertyTaxCredit).toBeCloseTo(500, 2);
      },
    );

    it.each([
      ["single", 250001, 12375.0495],
      ["marriedFilingJointly", 500001, 24750.0495],
      ["marriedFilingSeparately", 250001, 12375.0495],
    ] as const)(
      "%s: allows no credit at $%i of AGI, one dollar over the limit",
      (filingStatus, income, tax) => {
        // single and separate: $250,001 x 4.95% = $12,375.0495, no credit
        // joint:               $500,001 x 4.95% = $24,750.0495, no credit
        const result = calculate({
          federalIncome: income,
          filingStatus,
          propertyTaxesPaid: 10000,
        });

        expect(result.propertyTaxCredit).toBe(0);
        expect(result.totalTax).toBeCloseTo(tax, 2);
      },
    );
  });

  describe("capital gains, interest and dividends", () => {
    it("taxes short-term and long-term gains as ordinary income at 4.95%", () => {
      // $52,925 wages + $25,000 short-term + $25,000 long-term = $102,925
      // $102,925 - $2,925 = $100,000 x 4.95% = $4,950
      const result = calculate({
        federalIncome: 52925,
        shortTermCapitalGains: 25000,
        longTermCapitalGains: 25000,
      });

      expect(result.grossIncome).toBe(102925);
      expect(result.taxableOrdinaryIncome).toBe(100000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4950, 2);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ltcgTax).toBe(0);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.totalTax).toBeCloseTo(4950, 2);
    });

    it("taxes interest and dividends, qualified or not, as ordinary income", () => {
      // $52,925 wages + $10,000 interest + $5,000 dividends = $67,925
      // $67,925 - $2,925 = $65,000 x 4.95% = $3,217.50
      const result = calculate({
        federalIncome: 52925,
        interestIncome: 10000,
        ordinaryDividends: 5000,
        qualifiedDividends: 5000,
      });

      expect(result.interestIncome).toBe(10000);
      expect(result.ordinaryDividends).toBe(5000);
      expect(result.grossIncome).toBe(67925);
      expect(result.taxableOrdinaryIncome).toBe(65000);
      expect(result.totalTax).toBeCloseTo(3217.5, 2);
    });

    it("excludes U.S. Treasury interest", () => {
      // Interest: $10,000 - $4,000 from Treasuries = $6,000
      // $52,925 wages + $6,000 = $58,925
      // $58,925 - $2,925 = $56,000 x 4.95% = $2,772
      const result = calculate({
        federalIncome: 52925,
        interestIncome: 10000,
        treasuryInterest: 4000,
      });

      expect(result.interestIncome).toBe(6000);
      expect(result.grossIncome).toBe(58925);
      expect(result.taxableOrdinaryIncome).toBe(56000);
      expect(result.totalTax).toBeCloseTo(2772, 2);
    });
  });

  describe("safe harbor", () => {
    it("requires the lesser of 90% of this year's tax and 100% of last year's", () => {
      // This year: ($102,925 - $2,925) x 4.95% = $4,950 x 90% = $4,455
      // Last year: $4,000 x 100% = $4,000, the lesser
      const result = calculate({
        federalIncome: 102925,
        priorYearStateTax: 4000,
      });

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(4455, 2);
      expect(result.safeHarbor!.priorYearPercent).toBe(1);
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(4000);
      expect(result.safeHarbor!.minimum).toBe(4000);
    });

    it.each([[true], [false], [undefined]])(
      "stays at 100% of last year's tax when last year's income over $150,000 is %s",
      (priorYearIncomeOverThreshold) => {
        // Illinois has no higher percentage for high incomes
        const result = calculate({
          federalIncome: 102925,
          priorYearStateTax: 4000,
          priorYearIncomeOverThreshold,
        });

        expect(result.safeHarbor!.priorYearPercent).toBe(1);
        expect(result.safeHarbor!.priorYearSafeHarbor).toBe(4000);
      },
    );

    it("takes 90% of the tax after the property tax credit", () => {
      // Tax: $4,950 - ($5,000 x 5% = $250) = $4,700
      // $4,700 x 90% = $4,230
      const result = calculate({
        federalIncome: 102925,
        propertyTaxesPaid: 5000,
      });

      expect(result.totalTax).toBeCloseTo(4700, 2);
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(4230, 2);
      expect(result.safeHarbor!.minimum).toBeCloseTo(4230, 2);
    });
  });

  describe("shared building blocks", () => {
    it("uses state income rather than federal income when both are entered", () => {
      // $102,925 of state wages - $2,925 = $100,000
      const result = calculate({
        federalIncome: 120000,
        stateIncome: 102925,
      });

      expect(result.wageIncome).toBe(102925);
      expect(result.taxableOrdinaryIncome).toBe(100000);
    });

    it("subtracts 401(k) contributions and pre-tax medical", () => {
      // $117,925 - $10,000 401(k) - $5,000 medical = $102,925 AGI
      // $102,925 - $2,925 = $100,000
      const result = calculate({
        federalIncome: 117925,
        contributions401k: 10000,
        preTaxMedical: 5000,
      });

      expect(result.contributions401k).toBe(10000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.adjustedGrossIncome).toBe(102925);
      expect(result.taxableOrdinaryIncome).toBe(100000);
    });

    it("adds self-employment income and subtracts half of the self-employment tax", () => {
      // Gross: $100,000 wages + $50,000 self-employment = $150,000
      // Net earnings: $50,000 x 92.35% = $46,175
      // Self-employment tax: $46,175 x (12.4% + 2.9%) = $7,064.775
      // Deductible half: $3,532.3875
      // $150,000 - $3,532.3875 - $2,925 = $143,542.6125
      const result = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
      });

      expect(result.selfEmploymentIncome).toBe(50000);
      expect(result.grossIncome).toBe(150000);
      expect(result.deductibleSETax).toBeCloseTo(3532.3875, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(143542.6125, 2);
    });

    it("applies capital loss carryovers, with the limit for the filing status", () => {
      // Married filing separately: $1,500 of a $10,000 carryover is deductible
      // $102,925 - $1,500 - $2,925 = $98,500
      const result = calculate({
        federalIncome: 102925,
        filingStatus: "marriedFilingSeparately",
        priorYearShortTermLossCarryover: 10000,
      });

      expect(result.shortTermLossCarryoverOffset).toBe(1500);
      expect(result.shortTermLossCarryoverUnused).toBe(8500);
      expect(result.taxableOrdinaryIncome).toBe(98500);
    });

    it("counts withholding and estimated payments against the tax", () => {
      // Tax $4,950, paid $3,000 + $1,000 = $4,000, owed $950
      const result = calculate({
        federalIncome: 102925,
        stateTaxWithheld: 3000,
        stateEstimatedPaid: 1000,
      });

      expect(result.withheld).toBe(3000);
      expect(result.estimatedPaid).toBe(1000);
      expect(result.totalPaid).toBe(4000);
      expect(result.remainingOwed).toBeCloseTo(950, 2);
      expect(result.refundDue).toBe(0);
    });

    it("tests the safe harbor against total payments and last year's state tax", () => {
      // Required: lesser of $4,950 x 90% = $4,455 and $5,000 = $4,455
      // Paid $4,000: short by $455
      const result = calculate({
        federalIncome: 102925,
        stateTaxWithheld: 3000,
        stateEstimatedPaid: 1000,
        priorYearStateTax: 5000,
      });

      expect(result.safeHarbor!.minimum).toBeCloseTo(4455, 2);
      expect(result.safeHarbor!.met).toBe(false);
      expect(result.safeHarbor!.remaining).toBeCloseTo(455, 2);
    });
  });

  describe("zero and empty inputs", () => {
    it("returns zero for everything when nothing is entered", () => {
      const result = calculate();

      expect(result.grossIncome).toBe(0);
      expect(result.adjustedGrossIncome).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.propertyTaxCredit).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
      expect(result.safeHarbor!.minimum).toBe(0);
    });

    it("gives no property tax credit when there is no tax to reduce", () => {
      const result = calculate({ propertyTaxesPaid: 5000 });

      expect(result.propertyTaxCredit).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("leaves out the self-employment figures when there is no self-employment income", () => {
      const result = calculate({ federalIncome: 100000 });

      expect(result.selfEmploymentIncome).toBeUndefined();
      expect(result.deductibleSETax).toBeUndefined();
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateIllinoisTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    const calculateForYear = (overrides: Partial<TaxInputs>) =>
      calculateIllinoisTax(
        createDefaultInputs({
          taxYear: year,
          selectedState: "illinois",
          ...overrides,
        }),
        data.illinoisBrackets,
        data.illinoisDeductions,
        data.sharedLimits,
        data.illinoisLimits,
        data.ficaData,
      );

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it.each([
      "single",
      "marriedFilingJointly",
      "marriedFilingSeparately",
    ] as const)("uses the year's personal exemption and rate: %s", (filingStatus) => {
      const exemption = data.illinoisDeductions.personalExemption[filingStatus];
      const rate = data.illinoisBrackets.brackets[filingStatus][0].rate;

      const result = calculateForYear({ federalIncome: 100000, filingStatus });

      expect(result.deductionBreakdown.deductionAmount).toBe(exemption);
      expect(result.taxableOrdinaryIncome).toBe(100000 - exemption);
      expect(result.totalTax).toBeCloseTo((100000 - exemption) * rate, 2);
    });

    it("uses the year's income limit and property tax credit rate", () => {
      const limit = data.illinoisLimits.incomeLimit.default;
      const creditRate = data.illinoisLimits.propertyTaxCreditRate;

      const atLimit = calculateForYear({
        federalIncome: limit,
        propertyTaxesPaid: 10000,
      });
      const overLimit = calculateForYear({
        federalIncome: limit + 1,
        propertyTaxesPaid: 10000,
      });

      expect(atLimit.deductionBreakdown.deductionAmount).toBe(
        data.illinoisDeductions.personalExemption.single,
      );
      expect(atLimit.propertyTaxCredit).toBeCloseTo(10000 * creditRate, 2);
      expect(overLimit.deductionBreakdown.deductionAmount).toBe(0);
      expect(overLimit.propertyTaxCredit).toBe(0);
    });

    it("uses the year's income limit for married filing jointly", () => {
      const limit = data.illinoisLimits.incomeLimit.marriedFilingJointly;

      const atLimit = calculateForYear({
        federalIncome: limit,
        filingStatus: "marriedFilingJointly",
      });
      const overLimit = calculateForYear({
        federalIncome: limit + 1,
        filingStatus: "marriedFilingJointly",
      });

      expect(atLimit.deductionBreakdown.deductionAmount).toBe(
        data.illinoisDeductions.personalExemption.marriedFilingJointly,
      );
      expect(overLimit.deductionBreakdown.deductionAmount).toBe(0);
    });

    it("uses the year's safe harbor percentages", () => {
      const { currentYearPercent, priorYearPercent } =
        data.illinoisLimits.safeHarbor;

      const result = calculateForYear({
        federalIncome: 100000,
        priorYearStateTax: 1000,
      });

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        result.totalTax * currentYearPercent,
        2,
      );
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(
        1000 * priorYearPercent,
        2,
      );
    });
  },
);
