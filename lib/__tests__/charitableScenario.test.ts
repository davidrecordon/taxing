import { describe, it, expect } from "vitest";
import {
  CharitableScenario,
  compareWithNoGiving,
  summarizeCharitableScenario,
} from "../charitableScenario";
import { TaxInputs, TaxState } from "../types";
import { calculateResults } from "./calculateResults";
import { federalLimits } from "./testData";

// Scenario for one amount of giving, from the real calculators (2026)
const scenarioFor = (
  state: TaxState,
  inputs: Partial<TaxInputs>,
  charitableContributions: number,
): CharitableScenario => {
  const results = calculateResults(state, {
    ...inputs,
    charitableContributions,
  });
  return summarizeCharitableScenario(
    results.federal,
    results.state,
    federalLimits,
  );
};

// What a gift saves compared with giving nothing
const savingFor = (state: TaxState, inputs: Partial<TaxInputs>, gift: number) =>
  compareWithNoGiving(
    scenarioFor(state, inputs, 0),
    scenarioFor(state, inputs, gift),
  );

describe("summarizeCharitableScenario", () => {
  const itemizer: Partial<TaxInputs> = {
    federalIncome: 300000,
    stateTaxWithheld: 20000,
    propertyTaxesPaid: 10000,
    mortgageInterestPaid: 15000,
  };

  it("reports the full Federal floor when itemizing, whatever the gift", () => {
    // 0.5% of $300,000
    expect(scenarioFor("california", itemizer, 10000).federalFloor).toBe(1500);
    expect(scenarioFor("california", itemizer, 500).federalFloor).toBe(1500);
  });

  it("reports no floor when the Federal standard deduction is used", () => {
    const scenario = scenarioFor("california", { federalIncome: 150000 }, 2000);

    expect(scenario.federalItemizes).toBe(false);
    expect(scenario.federalFloor).toBe(0);
  });
});

describe("compareWithNoGiving", () => {
  it("counts Federal and California savings for an itemizer", () => {
    // Single, $300,000. Federal: ($10,000 - $1,500 floor) x 32% = $2,720.
    // California: $10,000 x 9.3% = $930.
    const saving = savingFor(
      "california",
      {
        federalIncome: 300000,
        stateTaxWithheld: 20000,
        propertyTaxesPaid: 10000,
        mortgageInterestPaid: 15000,
      },
      10000,
    );

    expect(saving.federalSaved).toBe(2720);
    expect(saving.stateSaved).toBe(930);
    expect(saving.totalSaved).toBe(3650);
  });

  it("does not blame California's income-based reduction, which the gift does not change", () => {
    // California reduces deductions by 6% of income over the threshold. That
    // amount is the same with or without the gift.
    const saving = savingFor(
      "california",
      {
        federalIncome: 300000,
        stateTaxWithheld: 20000,
        propertyTaxesPaid: 10000,
        mortgageInterestPaid: 15000,
      },
      10000,
    );

    expect(saving.stateLimitGrew).toBe(false);
  });

  it("flags New York allowing only part of the gift above $1,000,000 of income", () => {
    // Only half of charitable giving counts: 50% x $100,000 = $50,000
    const inputs: Partial<TaxInputs> = {
      federalIncome: 1500000,
      stateTaxWithheld: 100000,
      propertyTaxesPaid: 30000,
    };
    const saving = savingFor("newyork", inputs, 100000);

    expect(saving.stateLimitGrew).toBe(true);
    expect(saving.stateSaved).toBeGreaterThan(0);
    // Less than the gift at even the lowest New York rate that could apply
    expect(saving.stateSaved).toBeLessThan(100000 * 0.0685);
  });

  it("shows no New York saving when half the gift stays under the standard deduction", () => {
    // Above $1,000,000 only $5,000 of a $10,000 gift counts, below the
    // $8,000 standard deduction. The Federal return still benefits.
    const saving = savingFor(
      "newyork",
      {
        federalIncome: 1500000,
        stateTaxWithheld: 100000,
        mortgageInterestPaid: 20000,
      },
      10000,
    );

    expect(saving.stateSaved).toBe(0);
    expect(saving.federalSaved).toBeGreaterThan(0);
  });

  describe("DC, which takes the same type of deduction as the Federal return", () => {
    // Single, $150,000 of income, $14,000 of DC tax withheld. Without a gift
    // both returns take the $16,100 standard deduction.
    const inputs: Partial<TaxInputs> = {
      federalIncome: 150000,
      stateTaxWithheld: 14000,
    };

    it("shows no saving while the standard deduction on both returns is better", () => {
      // $5,000 less the $750 floor makes Federal itemized $18,250, worth
      // $2,150 x 24% = $516. DC would itemize only $4,250 and lose
      // $11,850 x 8.5% = $1,007.25, so both returns stay on the standard
      // deduction and the gift changes nothing.
      const scenario = scenarioFor("dc", inputs, 5000);
      const saving = compareWithNoGiving(
        scenarioFor("dc", inputs, 0),
        scenario,
      );

      expect(scenario.federalItemizes).toBe(false);
      expect(scenario.standardChosenForStateTax).toBe(true);
      expect(saving.federalSaved).toBe(0);
      expect(saving.stateSaved).toBe(0);
    });

    it("shows DC tax rising, and the total falling, once itemizing is worthwhile", () => {
      // $10,000 less the $750 floor makes Federal itemized $23,250:
      // $7,150 x 24% = $1,716 saved. DC itemizes $9,250 instead of $16,100:
      // $6,850 x 8.5% = $582.25 more tax.
      const saving = savingFor("dc", inputs, 10000);

      expect(saving.federalSaved).toBe(1716);
      expect(saving.stateSaved).toBe(-582);
      expect(saving.totalSaved).toBe(1134);
    });
  });

  it("shows no Colorado saving for a high-income itemizer", () => {
    // At $300,000 or more Colorado adds back deductions above $1,000, so a
    // larger Federal deduction is cancelled out
    const saving = savingFor(
      "colorado",
      {
        federalIncome: 400000,
        stateTaxWithheld: 20000,
        mortgageInterestPaid: 15000,
      },
      10000,
    );

    expect(saving.federalSaved).toBeGreaterThan(0);
    expect(saving.stateSaved).toBe(0);
  });

  it("counts Colorado's subtraction for a filer taking the standard deduction", () => {
    // ($3,000 - $500) x 4.4% = $110; nothing federally
    const saving = savingFor(
      "colorado",
      { federalIncome: 120000, filingStatus: "marriedFilingJointly" },
      3000,
    );

    expect(saving.federalSaved).toBe(0);
    expect(saving.stateSaved).toBe(110);
  });

  it("shows no state saving where the state does not deduct giving", () => {
    const inputs: Partial<TaxInputs> = {
      federalIncome: 300000,
      stateTaxWithheld: 20000,
      mortgageInterestPaid: 15000,
    };

    expect(savingFor("illinois", inputs, 10000).stateSaved).toBe(0);
    expect(savingFor("florida", inputs, 10000).stateSaved).toBe(0);
    expect(savingFor("washington", inputs, 10000).stateSaved).toBe(0);
  });

  it("flags the Federal top-bracket limit when the gift increases it", () => {
    // MFJ, $1,000,000: the limit is 2/37 of itemized deductions, so every
    // extra dollar deducted loses 2/37
    const saving = savingFor(
      "florida",
      {
        federalIncome: 1000000,
        stateTaxWithheld: 60000,
        mortgageInterestPaid: 30000,
        filingStatus: "marriedFilingJointly",
      },
      45000,
    );

    expect(saving.federalLimitGrew).toBe(true);
  });

  it("does not flag the Federal limit when it is set by income, not deductions", () => {
    // Single, $660,000: income over the top bracket ($19,400) is less than
    // itemized deductions either way, so the limit is the same with the gift
    const saving = savingFor(
      "florida",
      {
        federalIncome: 660000,
        stateTaxWithheld: 40000,
        mortgageInterestPaid: 20000,
      },
      23300,
    );

    expect(saving.federalSaved).toBeGreaterThan(0);
    expect(saving.federalLimitGrew).toBe(false);
  });

  it("rounds the parts so they add up to the total", () => {
    const scenario = (federalTax: number, stateTax: number) => ({
      federalTax,
      stateTax,
      federalFloor: 0,
      federalItemizes: true,
      standardChosenForStateTax: false,
      federalHighIncomeReduction: 0,
      stateHighIncomeReduction: 0,
    });
    const saving = compareWithNoGiving(
      scenario(1000.4, 500.4),
      scenario(900, 400),
    );

    expect(saving.federalSaved).toBe(100);
    expect(saving.stateSaved).toBe(100);
    expect(saving.totalSaved).toBe(200);
  });
});
