import { describe, it, expect, beforeAll } from "vitest";
import { calculateWashingtonTax } from "../states/washingtonTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import { TaxInputs } from "../types";
import {
  washingtonBrackets,
  washingtonLimits,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

// Figures for the default tax year (2026):
//   standard deduction $278,000 of long-term gains, for every filing status
//   7% on the next $1,000,000 (gains from $278,000 to $1,278,000)
//   9.9% on gains over $1,278,000
//   paying less than 80% of the tax is a substantial underpayment
const calculate = (overrides: Partial<TaxInputs> = {}) =>
  calculateWashingtonTax(
    createDefaultInputs({ selectedState: "washington", ...overrides }),
    washingtonBrackets,
    washingtonLimits,
  );

describe("calculateWashingtonTax", () => {
  describe("worked examples", () => {
    it("wages, short-term gains and $500,000 of long-term gains", () => {
      // Wages $200,000 and short-term gains $50,000: not taxed
      // Long-term gains                    $500,000
      // Standard deduction                -$278,000
      // Taxable gains                      $222,000
      // Tax: $222,000 x 7%                  $15,540
      // Estimated payments                 -$10,000
      // Owed                                 $5,540
      // 80% of the tax: $15,540 x 80% = $12,432, short by $2,432
      const result = calculate({
        federalIncome: 200000,
        shortTermCapitalGains: 50000,
        longTermCapitalGains: 500000,
        stateEstimatedPaid: 10000,
      });

      expect(result.grossIncome).toBe(750000);
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.taxableLTCG).toBe(222000);
      expect(result.ltcgTax).toBeCloseTo(15540, 2);
      expect(result.totalTax).toBeCloseTo(15540, 2);
      expect(result.remainingOwed).toBeCloseTo(5540, 2);
      expect(result.refundDue).toBe(0);
      expect(result.safeHarbor!.minimum).toBeCloseTo(12432, 2);
      expect(result.safeHarbor!.met).toBe(false);
      expect(result.safeHarbor!.remaining).toBeCloseTo(2432, 2);
    });

    it("married filing jointly: gains in the 9.9% tier, a loss carryover, overpaid", () => {
      // Long-term gains                  $1,600,000
      // Long-term loss carryover          -$100,000
      // Net long-term gains              $1,500,000
      // Standard deduction                -$278,000
      // Taxable gains                    $1,222,000
      // First $1,000,000 x 7%               $70,000
      // Remaining $222,000 x 9.9%           $21,978
      // Tax                                 $91,978
      // Estimated payments                -$100,000
      // Refund                               $8,022
      const result = calculate({
        filingStatus: "marriedFilingJointly",
        longTermCapitalGains: 1600000,
        priorYearLongTermLossCarryover: 100000,
        stateEstimatedPaid: 100000,
      });

      expect(result.longTermLossCarryoverOffset).toBe(100000);
      expect(result.taxableLTCG).toBe(1222000);
      expect(result.ltcgTax).toBeCloseTo(91978, 2);
      expect(result.totalTax).toBeCloseTo(91978, 2);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBeCloseTo(8022, 2);
      expect(result.safeHarbor!.met).toBe(true);
    });

    it("married filing separately: long-term gains under the deduction", () => {
      // Wages $150,000: not taxed
      // Long-term gains $200,000, under the $278,000 deduction: no tax
      const result = calculate({
        filingStatus: "marriedFilingSeparately",
        federalIncome: 150000,
        longTermCapitalGains: 200000,
      });

      expect(result.grossIncome).toBe(350000);
      expect(result.taxableLTCG).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe("income that is not taxed", () => {
    it("does not tax $500,000 of wages", () => {
      const result = calculate({ federalIncome: 500000 });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeBracketBreakdown).toEqual([]);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("does not tax $300,000 of interest and $300,000 of dividends", () => {
      const result = calculate({
        interestIncome: 300000,
        ordinaryDividends: 300000,
        qualifiedDividends: 300000,
      });

      expect(result.taxableLTCG).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("does not tax $2,000,000 of short-term gains", () => {
      const result = calculate({ shortTermCapitalGains: 2000000 });

      expect(result.taxableLTCG).toBe(0);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.ltcgTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("does not count wages or short-term gains against the deduction", () => {
      // Only the long-term gains matter: ($378,000 - $278,000) x 7% = $7,000
      const result = calculate({
        federalIncome: 500000,
        shortTermCapitalGains: 500000,
        longTermCapitalGains: 378000,
      });

      expect(result.taxableLTCG).toBe(100000);
      expect(result.totalTax).toBeCloseTo(7000, 2);
    });
  });

  describe("standard deduction", () => {
    it("gives no tax at exactly $278,000 of long-term gains", () => {
      const result = calculate({ longTermCapitalGains: 278000 });

      expect(result.taxableLTCG).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("taxes the first dollar over $278,000 at 7%", () => {
      // $278,001 - $278,000 = $1 x 7% = $0.07
      const result = calculate({ longTermCapitalGains: 278001 });

      expect(result.taxableLTCG).toBe(1);
      expect(result.totalTax).toBeCloseTo(0.07, 4);
    });

    it.each([
      "single",
      "marriedFilingJointly",
      "marriedFilingSeparately",
    ] as const)(
      "%s: uses the same $278,000 deduction and the same tiers",
      (filingStatus) => {
        // $2,278,000 - $278,000 = $2,000,000 taxable
        // $1,000,000 x 7% + $1,000,000 x 9.9% = $70,000 + $99,000 = $169,000
        const result = calculate({
          filingStatus,
          longTermCapitalGains: 2278000,
        });

        expect(result.taxableLTCG).toBe(2000000);
        expect(result.totalTax).toBeCloseTo(169000, 2);
      },
    );
  });

  describe("rate tiers", () => {
    it("taxes $500,000 of taxable gains at 7%", () => {
      // $778,000 - $278,000 = $500,000 x 7% = $35,000
      const result = calculate({ longTermCapitalGains: 778000 });

      expect(result.taxableLTCG).toBe(500000);
      expect(result.ltcgTax).toBeCloseTo(35000, 2);
      expect(result.totalTax).toBeCloseTo(35000, 2);
    });

    it("taxes exactly $1,000,000 of taxable gains at 7% only", () => {
      // $1,278,000 - $278,000 = $1,000,000 x 7% = $70,000
      const result = calculate({ longTermCapitalGains: 1278000 });

      expect(result.taxableLTCG).toBe(1000000);
      expect(result.totalTax).toBeCloseTo(70000, 4);
    });

    it("taxes the first dollar over $1,000,000 of taxable gains at 9.9%", () => {
      // $1,278,001 - $278,000 = $1,000,001 taxable
      // $1,000,000 x 7% + $1 x 9.9% = $70,000.099
      const result = calculate({ longTermCapitalGains: 1278001 });

      expect(result.taxableLTCG).toBe(1000001);
      expect(result.totalTax).toBeCloseTo(70000.099, 4);
    });

    it("taxes $222,000 of taxable gains over $1,000,000 at 9.9%", () => {
      // $1,500,000 - $278,000 = $1,222,000 taxable
      // $1,000,000 x 7% + $222,000 x 9.9% = $70,000 + $21,978 = $91,978
      const result = calculate({ longTermCapitalGains: 1500000 });

      expect(result.taxableLTCG).toBe(1222000);
      expect(result.totalTax).toBeCloseTo(91978, 2);
    });
  });

  describe("bracket breakdown", () => {
    it("returns a row for the deduction, the 7% tier and the 9.9% tier", () => {
      // $1,500,000 of gains: $278,000 at 0%, $1,000,000 at 7%, $222,000 at 9.9%
      const rows = calculate({
        longTermCapitalGains: 1500000,
      }).ltcgBracketBreakdown;

      expect(rows).toHaveLength(3);

      expect(rows[0].bracketMin).toBe(0);
      expect(rows[0].bracketMax).toBe(278000);
      expect(rows[0].rate).toBe(0);
      expect(rows[0].incomeInBracket).toBe(278000);
      expect(rows[0].taxForBracket).toBe(0);

      expect(rows[1].bracketMin).toBe(278000);
      expect(rows[1].bracketMax).toBe(1278000);
      expect(rows[1].rate).toBe(0.07);
      expect(rows[1].incomeInBracket).toBe(1000000);
      expect(rows[1].taxForBracket).toBeCloseTo(70000, 2);

      expect(rows[2].bracketMin).toBe(1278000);
      expect(rows[2].bracketMax).toBeNull();
      expect(rows[2].rate).toBe(0.099);
      expect(rows[2].incomeInBracket).toBe(222000);
      expect(rows[2].taxForBracket).toBeCloseTo(21978, 2);
    });

    it("returns only the deduction row at exactly $278,000 of gains", () => {
      const rows = calculate({
        longTermCapitalGains: 278000,
      }).ltcgBracketBreakdown;

      expect(rows).toHaveLength(1);
      expect(rows[0].rate).toBe(0);
      expect(rows[0].incomeInBracket).toBe(278000);
    });

    it("returns no 9.9% row at exactly $1,278,000 of gains", () => {
      const rows = calculate({
        longTermCapitalGains: 1278000,
      }).ltcgBracketBreakdown;

      expect(rows).toHaveLength(2);
      expect(rows[1].rate).toBe(0.07);
      expect(rows[1].incomeInBracket).toBe(1000000);
    });

    it("returns no rows when there are no long-term gains", () => {
      const result = calculate({ federalIncome: 100000 });

      expect(result.ltcgBracketBreakdown).toEqual([]);
    });
  });

  describe("losses and loss carryovers", () => {
    it("subtracts a long-term loss carryover from long-term gains", () => {
      // $400,000 - $50,000 carryover = $350,000
      // $350,000 - $278,000 = $72,000 x 7% = $5,040
      const result = calculate({
        longTermCapitalGains: 400000,
        priorYearLongTermLossCarryover: 50000,
      });

      expect(result.longTermLossCarryoverOffset).toBe(50000);
      expect(result.taxableLTCG).toBe(72000);
      expect(result.totalTax).toBeCloseTo(5040, 2);
    });

    it("uses no more of a long-term loss carryover than the gains", () => {
      // $300,000 of gains, $500,000 carryover: $300,000 is used, no tax
      const result = calculate({
        longTermCapitalGains: 300000,
        priorYearLongTermLossCarryover: 500000,
      });

      expect(result.longTermLossCarryoverOffset).toBe(300000);
      expect(result.taxableLTCG).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("does not subtract a short-term loss carryover", () => {
      // $400,000 - $278,000 = $122,000 x 7% = $8,540, whatever the carryover
      const result = calculate({
        longTermCapitalGains: 400000,
        priorYearShortTermLossCarryover: 100000,
      });

      expect(result.shortTermLossCarryoverOffset).toBe(0);
      expect(result.taxableLTCG).toBe(122000);
      expect(result.totalTax).toBeCloseTo(8540, 2);
    });

    it("does not subtract a short-term loss this year", () => {
      // $400,000 - $278,000 = $122,000 x 7% = $8,540, whatever the loss
      const result = calculate({
        shortTermCapitalGains: -100000,
        longTermCapitalGains: 400000,
      });

      expect(result.taxableLTCG).toBe(122000);
      expect(result.totalTax).toBeCloseTo(8540, 2);
    });

    it("gives no tax, and uses no carryover, on a long-term loss this year", () => {
      const result = calculate({
        longTermCapitalGains: -50000,
        priorYearLongTermLossCarryover: 20000,
      });

      expect(result.longTermCapitalGains).toBe(-50000);
      expect(result.longTermLossCarryoverOffset).toBe(0);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.totalTax).toBe(0);
    });
  });

  describe("gross income", () => {
    it("adds short-term and long-term gains to wages", () => {
      // $100,000 + $50,000 + $300,000 = $450,000
      const result = calculate({
        federalIncome: 100000,
        shortTermCapitalGains: 50000,
        longTermCapitalGains: 300000,
      });

      expect(result.wageIncome).toBe(100000);
      expect(result.shortTermCapitalGains).toBe(50000);
      expect(result.longTermCapitalGains).toBe(300000);
      expect(result.grossIncome).toBe(450000);
    });

    it("includes self-employment income, interest and dividends", () => {
      // $100,000 + $20,000 + $5,000 + $3,000 = $128,000
      const result = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 20000,
        interestIncome: 5000,
        ordinaryDividends: 3000,
      });

      expect(result.grossIncome).toBe(128000);
    });

    it("does not subtract this year's capital losses", () => {
      // $100,000 of wages; the $20,000 and $30,000 losses are left out
      const result = calculate({
        federalIncome: 100000,
        shortTermCapitalGains: -20000,
        longTermCapitalGains: -30000,
      });

      expect(result.shortTermCapitalGains).toBe(-20000);
      expect(result.longTermCapitalGains).toBe(-30000);
      expect(result.grossIncome).toBe(100000);
    });

    it("uses state income rather than federal income when both are entered", () => {
      // $100,000 of state wages + $300,000 of long-term gains = $400,000
      const result = calculate({
        federalIncome: 200000,
        stateIncome: 100000,
        longTermCapitalGains: 300000,
      });

      expect(result.wageIncome).toBe(100000);
      expect(result.grossIncome).toBe(400000);
    });
  });

  describe("80% rule", () => {
    // $778,000 of long-term gains throughout:
    // ($778,000 - $278,000) x 7% = $35,000 of tax, and 80% of it is $28,000

    it("shows 80% of this year's tax as the amount to pay", () => {
      const result = calculate({ longTermCapitalGains: 778000 });

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(28000, 2);
      expect(result.safeHarbor!.minimum).toBeCloseTo(28000, 2);
    });

    it("makes no comparison with last year's tax", () => {
      // Last year's $1,000 would be the lesser amount if it were compared
      const result = calculate({
        longTermCapitalGains: 778000,
        priorYearStateTax: 1000,
      });

      expect(result.safeHarbor!.priorYearPercent).toBeUndefined();
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(0);
      expect(result.safeHarbor!.minimum).toBeCloseTo(28000, 2);
    });

    it("is met when exactly 80% of the tax, $28,000, has been paid", () => {
      const result = calculate({
        longTermCapitalGains: 778000,
        stateEstimatedPaid: 28000,
      });

      expect(result.safeHarbor!.met).toBe(true);
      expect(result.safeHarbor!.remaining).toBe(0);
    });

    it("is not met when $27,999, one dollar under 80%, has been paid", () => {
      const result = calculate({
        longTermCapitalGains: 778000,
        stateEstimatedPaid: 27999,
      });

      expect(result.safeHarbor!.met).toBe(false);
      expect(result.safeHarbor!.remaining).toBeCloseTo(1, 2);
    });
  });

  describe("shared building blocks", () => {
    it("counts withholding and estimated payments against the tax", () => {
      // Tax $35,000, paid $5,000 + $20,000 = $25,000, owed $10,000
      const result = calculate({
        longTermCapitalGains: 778000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 20000,
      });

      expect(result.withheld).toBe(5000);
      expect(result.estimatedPaid).toBe(20000);
      expect(result.totalPaid).toBe(25000);
      expect(result.remainingOwed).toBeCloseTo(10000, 2);
      expect(result.refundDue).toBe(0);
    });
  });

  describe("zero and empty inputs", () => {
    it("returns zero for everything when nothing is entered", () => {
      const result = calculate();

      expect(result.grossIncome).toBe(0);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
      expect(result.safeHarbor!.minimum).toBe(0);
      expect(result.safeHarbor!.met).toBe(true);
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateWashingtonTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    const calculateForYear = (overrides: Partial<TaxInputs>) =>
      calculateWashingtonTax(
        createDefaultInputs({
          taxYear: year,
          selectedState: "washington",
          ...overrides,
        }),
        data.washingtonBrackets,
        data.washingtonLimits,
      );

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("uses the year's standard deduction", () => {
      const { exemption } = data.washingtonLimits;

      const atDeduction = calculateForYear({ longTermCapitalGains: exemption });
      const over = calculateForYear({
        longTermCapitalGains: exemption + 100000,
      });

      expect(atDeduction.totalTax).toBe(0);
      expect(over.taxableLTCG).toBe(100000);
    });

    it("uses the year's base rate on gains over the deduction", () => {
      const { baseRate, exemption } = data.washingtonLimits;

      const result = calculateForYear({
        longTermCapitalGains: exemption + 100000,
      });

      expect(result.totalTax).toBeCloseTo(100000 * baseRate, 2);
    });

    it("starts the year's higher rate at the deduction plus the surtax threshold", () => {
      const { baseRate, exemption, surtaxRate, surtaxThreshold } =
        data.washingtonLimits;

      const atThreshold = calculateForYear({
        longTermCapitalGains: exemption + surtaxThreshold,
      });
      const over = calculateForYear({
        longTermCapitalGains: exemption + surtaxThreshold + 100000,
      });

      expect(atThreshold.totalTax).toBeCloseTo(surtaxThreshold * baseRate, 2);
      expect(over.totalTax).toBeCloseTo(
        surtaxThreshold * baseRate + 100000 * (baseRate + surtaxRate),
        2,
      );
    });

    it("uses the year's underpayment percentage", () => {
      const { exemption, safeHarbor } = data.washingtonLimits;

      const result = calculateForYear({
        longTermCapitalGains: exemption + 100000,
      });

      expect(result.safeHarbor!.minimum).toBeCloseTo(
        result.totalTax * safeHarbor.percent,
        2,
      );
    });
  },
);
