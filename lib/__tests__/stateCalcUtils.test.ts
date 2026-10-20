import { describe, it, expect } from "vitest";
import {
  calculateDeductibleSETax,
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateIncome,
  selectPriorYearPercent,
} from "../states/stateCalcUtils";
import { createDefaultInputs, ficaData, sharedLimits } from "./testData";

// What the states that tax all income as ordinary income share. The state
// calculator tests only check that each state feeds these the right inputs.

describe("calculateStateIncome", () => {
  describe("wages", () => {
    it("uses the state income when one is entered", () => {
      const income = calculateStateIncome(
        createDefaultInputs({ federalIncome: 100000, stateIncome: 80000 }),
        sharedLimits,
        ficaData,
      );

      expect(income.stateIncome).toBe(80000);
      expect(income.grossIncome).toBe(80000);
    });

    it("falls back to the Federal income when no state income is entered", () => {
      const income = calculateStateIncome(
        createDefaultInputs({ federalIncome: 100000, stateIncome: 0 }),
        sharedLimits,
        ficaData,
      );

      expect(income.stateIncome).toBe(100000);
      expect(income.grossIncome).toBe(100000);
    });
  });

  describe("gross income", () => {
    it("adds wages, self-employment income, interest, dividends and both kinds of capital gain", () => {
      // $100,000 + $20,000 + $5,000 + $4,000 + $10,000 + $30,000 = $169,000
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          selfEmploymentIncome: 20000,
          interestIncome: 5000,
          ordinaryDividends: 4000,
          shortTermCapitalGains: 10000,
          longTermCapitalGains: 30000,
        }),
        sharedLimits,
      );

      expect(income.grossIncome).toBe(169000);
      expect(income.selfEmploymentIncome).toBe(20000);
      expect(income.interestIncome).toBe(5000);
      expect(income.ordinaryDividends).toBe(4000);
    });

    it("leaves out U.S. Treasury interest, which states cannot tax", () => {
      // $5,000 of interest, $2,000 of it from Treasuries: $3,000 is taxable
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          interestIncome: 5000,
          treasuryInterest: 2000,
        }),
        sharedLimits,
      );

      expect(income.interestIncome).toBe(3000);
      expect(income.grossIncome).toBe(103000);
    });

    it("counts qualified dividends once, as part of ordinary dividends", () => {
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          ordinaryDividends: 4000,
          qualifiedDividends: 3000,
        }),
        sharedLimits,
      );

      expect(income.ordinaryDividends).toBe(4000);
      expect(income.grossIncome).toBe(104000);
    });

    it("does not count a capital loss as negative income", () => {
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          shortTermCapitalGains: -8000,
        }),
        sharedLimits,
      );

      expect(income.grossIncome).toBe(100000);
    });
  });

  describe("adjusted gross income", () => {
    it("subtracts 401(k) contributions and pre-tax medical from gross income", () => {
      // $100,000 - $20,000 - $5,000 = $75,000
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          contributions401k: 20000,
          preTaxMedical: 5000,
        }),
        sharedLimits,
      );

      expect(income.grossIncome).toBe(100000);
      expect(income.adjustedGrossIncome).toBe(75000);
    });

    it("subtracts the deductible half of self-employment tax", () => {
      // Net earnings $100,000 x 92.35% = $92,350. Social Security 12.4% =
      // $11,451.40, Medicare 2.9% = $2,678.15; half of $14,129.55 = $7,064.775
      const income = calculateStateIncome(
        createDefaultInputs({ selfEmploymentIncome: 100000 }),
        sharedLimits,
        ficaData,
      );

      expect(income.deductibleSETax).toBeCloseTo(7064.775, 2);
      expect(income.adjustedGrossIncome).toBeCloseTo(92935.225, 2);
    });

    it("measures the Social Security wage base against Federal wages, not state wages", () => {
      // Federal wages of $184,500 use up the wage base, so only Medicare
      // applies: $92,350 x 2.9% = $2,678.15, half of which is $1,339.075.
      // State wages of $50,000 do not reopen it.
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 184500,
          stateIncome: 50000,
          selfEmploymentIncome: 100000,
        }),
        sharedLimits,
        ficaData,
      );

      expect(income.deductibleSETax).toBeCloseTo(1339.075, 2);
      // $50,000 + $100,000 - $1,339.075
      expect(income.adjustedGrossIncome).toBeCloseTo(148660.925, 2);
    });

    it("deducts no self-employment tax when payroll tax data is not supplied", () => {
      const income = calculateStateIncome(
        createDefaultInputs({ selfEmploymentIncome: 100000 }),
        sharedLimits,
      );

      expect(income.deductibleSETax).toBe(0);
      expect(income.adjustedGrossIncome).toBe(100000);
    });
  });

  describe("capital losses", () => {
    // The netting rules themselves are tested in taxUtils.test.ts

    it("subtracts a loss carryover used against gains", () => {
      // $20,000 of long-term gains less a $5,000 carryover
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          longTermCapitalGains: 20000,
          priorYearLongTermLossCarryover: 5000,
        }),
        sharedLimits,
      );

      expect(income.grossIncome).toBe(120000);
      expect(income.longTermLossCarryoverOffset).toBe(5000);
      expect(income.adjustedGrossIncome).toBe(115000);
    });

    it("deducts up to $3,000 of a net loss from other income and reports the rest as unused", () => {
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          priorYearShortTermLossCarryover: 10000,
        }),
        sharedLimits,
      );

      expect(income.shortTermLossCarryoverOffset).toBe(3000);
      expect(income.shortTermLossCarryoverUnused).toBe(7000);
      expect(income.adjustedGrossIncome).toBe(97000);
    });

    it("uses the $1,500 limit for married filing separately", () => {
      const income = calculateStateIncome(
        createDefaultInputs({
          federalIncome: 100000,
          priorYearShortTermLossCarryover: 10000,
          filingStatus: "marriedFilingSeparately",
        }),
        sharedLimits,
      );

      expect(income.shortTermLossCarryoverOffset).toBe(1500);
      expect(income.adjustedGrossIncome).toBe(98500);
    });

    it("counts interest, dividends and self-employment income as other income the loss can offset", () => {
      // No wages: the $3,000 deduction is allowed against $2,000 of interest
      // plus $2,000 of dividends
      const income = calculateStateIncome(
        createDefaultInputs({
          interestIncome: 2000,
          ordinaryDividends: 2000,
          priorYearShortTermLossCarryover: 10000,
        }),
        sharedLimits,
      );

      expect(income.shortTermLossCarryoverOffset).toBe(3000);
      expect(income.adjustedGrossIncome).toBe(1000);
    });
  });
});

describe("calculateDeductibleSETax", () => {
  it("is half of 15.3% of 92.35% of self-employment income", () => {
    // $100,000 x 92.35% = $92,350; x 12.4% = $11,451.40; x 2.9% = $2,678.15;
    // half of $14,129.55 = $7,064.775
    expect(calculateDeductibleSETax(100000, 0, ficaData)).toBeCloseTo(
      7064.775,
      2,
    );
  });

  it("applies Social Security only to the wage base left after wages", () => {
    // Wage base $184,500 less $150,000 of wages leaves $34,500:
    // $34,500 x 12.4% = $4,278, plus Medicare $2,678.15; half = $3,478.075
    expect(calculateDeductibleSETax(100000, 150000, ficaData)).toBeCloseTo(
      3478.075,
      2,
    );
  });

  it("applies only Medicare when wages reach the $184,500 wage base", () => {
    // $92,350 x 2.9% = $2,678.15; half = $1,339.075
    expect(calculateDeductibleSETax(100000, 184500, ficaData)).toBeCloseTo(
      1339.075,
      2,
    );
  });

  it("still applies only Medicare when wages are over the wage base", () => {
    expect(calculateDeductibleSETax(100000, 250000, ficaData)).toBeCloseTo(
      1339.075,
      2,
    );
  });

  it("applies Social Security to one more dollar when wages are a dollar under the wage base", () => {
    // $1 x 12.4% = $0.124 more tax, half of which is $0.062
    expect(calculateDeductibleSETax(100000, 184499, ficaData)).toBeCloseTo(
      1339.137,
      3,
    );
  });

  it("is zero with no self-employment income, or a loss", () => {
    expect(calculateDeductibleSETax(0, 100000, ficaData)).toBe(0);
    expect(calculateDeductibleSETax(-5000, 100000, ficaData)).toBe(0);
  });
});

describe("calculatePaymentSummary", () => {
  it("adds withholding and estimated payments", () => {
    expect(calculatePaymentSummary(10000, 6000, 1500).totalPaid).toBe(7500);
  });

  it("reports the shortfall as owed, with no refund", () => {
    const summary = calculatePaymentSummary(10000, 6000, 1500);

    expect(summary.remainingOwed).toBe(2500);
    expect(summary.refundDue).toBe(0);
  });

  it("reports an overpayment as a refund, with nothing owed", () => {
    const summary = calculatePaymentSummary(10000, 9000, 3000);

    expect(summary.remainingOwed).toBe(0);
    expect(summary.refundDue).toBe(2000);
  });

  it("reports neither when payments equal the tax", () => {
    const summary = calculatePaymentSummary(10000, 10000, 0);

    expect(summary.remainingOwed).toBe(0);
    expect(summary.refundDue).toBe(0);
  });

  it("refunds everything paid when there is no tax", () => {
    expect(calculatePaymentSummary(0, 4000, 1000).refundDue).toBe(5000);
  });
});

describe("calculateSafeHarbor", () => {
  const config = { currentYearPercent: 0.9, priorYearPercent: 1.1 };

  it("requires the lesser of this year's share and last year's share", () => {
    // 90% x $20,000 = $18,000; 110% x $10,000 = $11,000
    const safeHarbor = calculateSafeHarbor(20000, 0, 10000, config);

    expect(safeHarbor.currentYear90Percent).toBe(18000);
    expect(safeHarbor.priorYearSafeHarbor).toBeCloseTo(11000, 2);
    expect(safeHarbor.minimum).toBeCloseTo(11000, 2);
    expect(safeHarbor.priorYearPercent).toBe(1.1);
  });

  it("uses this year's share when it is the smaller", () => {
    // 90% x $10,000 = $9,000; 110% x $20,000 = $22,000
    expect(calculateSafeHarbor(10000, 0, 20000, config).minimum).toBe(9000);
  });

  it("uses only this year's share when last year's tax is not entered", () => {
    const safeHarbor = calculateSafeHarbor(20000, 0, 0, config);

    expect(safeHarbor.priorYearSafeHarbor).toBe(0);
    expect(safeHarbor.minimum).toBe(18000);
  });

  it("uses only this year's share where the jurisdiction has no prior-year method", () => {
    // 80% x $20,000 = $16,000, whatever last year's tax was
    const safeHarbor = calculateSafeHarbor(20000, 0, 10000, {
      currentYearPercent: 0.8,
    });

    expect(safeHarbor.priorYearSafeHarbor).toBe(0);
    expect(safeHarbor.minimum).toBe(16000);
    expect(safeHarbor.priorYearPercent).toBeUndefined();
  });

  it("uses only this year's share under the high-income exception, while still reporting last year's", () => {
    const safeHarbor = calculateSafeHarbor(20000, 0, 10000, {
      ...config,
      isHighIncome: true,
    });

    expect(safeHarbor.minimum).toBe(18000);
    expect(safeHarbor.priorYearSafeHarbor).toBeCloseTo(11000, 2);
    expect(safeHarbor.highIncomeException).toBe(true);
  });

  it("is met when payments equal the minimum exactly", () => {
    // Whole-dollar minimum: 90% x $20,000 = $18,000
    const safeHarbor = calculateSafeHarbor(20000, 18000, 0, config);

    expect(safeHarbor.met).toBe(true);
    expect(safeHarbor.remaining).toBe(0);
  });

  it("is not met one dollar under the minimum, and reports the dollar still needed", () => {
    const safeHarbor = calculateSafeHarbor(20000, 17999, 0, config);

    expect(safeHarbor.met).toBe(false);
    expect(safeHarbor.remaining).toBe(1);
  });

  it("is met by a payment equal to the minimum when the tax is not exact in binary", () => {
    // $222,000 x 7% is $15,540 but computes as 15540.000000000002, and 80%
    // of that as 12432.000000000002
    const safeHarbor = calculateSafeHarbor(222000 * 0.07, 12432, 0, {
      currentYearPercent: 0.8,
    });

    expect(safeHarbor.met).toBe(true);
    expect(safeHarbor.remaining).toBe(0);
  });

  it("is not met one cent under the minimum", () => {
    const safeHarbor = calculateSafeHarbor(222000 * 0.07, 12431.99, 0, {
      currentYearPercent: 0.8,
    });

    expect(safeHarbor.met).toBe(false);
    expect(safeHarbor.remaining).toBeCloseTo(0.01, 4);
  });

  it("needs nothing more once payments pass the minimum", () => {
    const safeHarbor = calculateSafeHarbor(20000, 25000, 0, config);

    expect(safeHarbor.met).toBe(true);
    expect(safeHarbor.remaining).toBe(0);
  });

  it("is met with no payments when there is no tax", () => {
    const safeHarbor = calculateSafeHarbor(0, 0, 0, config);

    expect(safeHarbor.minimum).toBe(0);
    expect(safeHarbor.met).toBe(true);
  });
});

describe("selectPriorYearPercent", () => {
  // Federal, California, New York and Colorado: 100%, or 110% when last
  // year's income was over $150,000
  const twoTier = { highIncomePriorYearPercent: 1.1, priorYearPercent: 1 };
  // DC and Illinois: one percentage for everyone
  const oneTier = { priorYearPercent: 1.1 };

  it("uses the higher percentage when last year's income was over the threshold", () => {
    expect(
      selectPriorYearPercent(twoTier, { priorYearIncomeOverThreshold: true }),
    ).toBe(1.1);
  });

  it("uses the base percentage when it was not", () => {
    expect(
      selectPriorYearPercent(twoTier, { priorYearIncomeOverThreshold: false }),
    ).toBe(1);
  });

  it("assumes last year's income was over the threshold when not stated", () => {
    expect(selectPriorYearPercent(twoTier, {})).toBe(1.1);
  });

  it("uses the single percentage where the jurisdiction has only one", () => {
    expect(
      selectPriorYearPercent(oneTier, { priorYearIncomeOverThreshold: true }),
    ).toBe(1.1);
    expect(
      selectPriorYearPercent(oneTier, { priorYearIncomeOverThreshold: false }),
    ).toBe(1.1);
  });
});
