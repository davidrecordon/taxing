import { describe, expect, it } from "vitest";
import {
  calculateCharitableScenario,
  calculateEstimate,
  calculateJointScenario,
  calculateMFSScenario,
  calculateTaxes,
} from "../calculate";
import { TAX_YEAR } from "../config";
import { calculateFederalTax } from "../federalTaxCalculator";
import { calculateCaliforniaTax } from "../states/californiaTaxCalculator";
import { calculateDCTax } from "../states/dcTaxCalculator";
import { loadFederalData, loadStateDataSync } from "../taxData";
import { TaxState } from "../types";
import { calculateResults } from "./calculateResults";
import { createDefaultInputs } from "./testData";

// How the federal and state calculators are run together. The calculators'
// own rules are tested in their own files; these tests check that this
// module hands them the right inputs and combines what comes back.

const federalData = loadFederalData(TAX_YEAR);
const dataFor = (state: TaxState) => loadStateDataSync(state, TAX_YEAR);

const STATES: TaxState[] = [
  "california",
  "colorado",
  "dc",
  "florida",
  "illinois",
  "newyork",
  "washington",
];

describe("calculateTaxes", () => {
  it("runs the federal calculator and the state's calculator on the same inputs", () => {
    const inputs = createDefaultInputs({
      selectedState: "california",
      federalIncome: 300000,
      longTermCapitalGains: 50000,
      federalTaxWithheld: 60000,
      stateTaxWithheld: 20000,
    });
    const data = dataFor("california");

    const { federal, state } = calculateTaxes(inputs, federalData, data);

    expect(federal).toEqual(
      calculateFederalTax(
        inputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
      ),
    );
    expect(state).toEqual(
      calculateCaliforniaTax(
        inputs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.brackets as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.deductions as any,
        federalData.sharedLimits,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.limits as any,
        federalData.ficaData,
      ),
    );
  });

  it.each(STATES)("produces a state result for %s", (state) => {
    const inputs = createDefaultInputs({
      selectedState: state,
      federalIncome: 250000,
      longTermCapitalGains: 400000,
    });

    const result = calculateTaxes(inputs, federalData, dataFor(state));

    expect(result.federal.totalTax).toBeGreaterThan(0);
    expect(result.state.totalTax).toBeGreaterThanOrEqual(0);
    expect(result.state.wageIncome).toBe(
      state === "washington" || state === "florida" ? 250000 : 250000,
    );
  });

  it("chooses the federal deduction type together with the state's in DC and Colorado", () => {
    // Which type wins is decided in deductionChoice.ts and tested there; here
    // the state result must follow whatever the federal return took
    const inputs = createDefaultInputs({
      selectedState: "dc",
      federalIncome: 200000,
      propertyTaxesPaid: 10000,
      charitableContributions: 9000,
    });

    const { federal, state } = calculateTaxes(inputs, federalData, dataFor("dc"));

    expect(state.deductionBreakdown.followsFederalChoice).toBe(true);
    expect(state.deductionBreakdown.deductionUsed).toBe(
      federal.deductionBreakdown.deductionUsed,
    );
    // Neither forced choice beats the pair chosen together
    const combined = federal.totalTax + state.totalTax;
    for (const choice of ["standard", "itemized"] as const) {
      const forcedFederal = calculateFederalTax(
        inputs,
        federalData.federalBrackets,
        federalData.ltcgBrackets,
        federalData.federalDeductions,
        federalData.sharedLimits,
        federalData.federalLimits,
        federalData.ficaData,
        choice,
      );
      const forcedState = calculateDCTax(
        inputs,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataFor("dc").brackets as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataFor("dc").deductions as any,
        federalData.sharedLimits,
        federalData.federalLimits,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dataFor("dc").limits as any,
        federalData.ficaData,
        forcedFederal.deductionBreakdown,
      );
      expect(combined).toBeLessThanOrEqual(
        forcedFederal.totalTax + forcedState.totalTax + 0.005,
      );
    }
  });

  it("is what the test helper calculateResults() returns", () => {
    const overrides = {
      federalIncome: 400000,
      ordinaryDividends: 10000,
      qualifiedDividends: 8000,
      charitableContributions: 20000,
      priorYearFederalTax: 90000,
      priorYearStateTax: 30000,
    };
    const inputs = createDefaultInputs({
      selectedState: "newyork",
      ...overrides,
    });

    expect(calculateTaxes(inputs, federalData, dataFor("newyork"))).toEqual(
      calculateResults("newyork", overrides),
    );
  });
});

describe("calculateEstimate", () => {
  it("estimates withholding that was not entered and says so", () => {
    const inputs = createDefaultInputs({
      selectedState: "california",
      federalIncome: 200000,
    });

    const { results, withholdingEstimate, resolvedInputs } = calculateEstimate(
      inputs,
      federalData,
      dataFor("california"),
    );

    expect(withholdingEstimate.federal).toBeGreaterThan(0);
    expect(withholdingEstimate.state).toBeGreaterThan(0);
    expect(resolvedInputs.federalTaxWithheld).toBe(withholdingEstimate.federal);
    expect(resolvedInputs.stateTaxWithheld).toBe(withholdingEstimate.state);
    expect(results.federal.withheld).toBe(withholdingEstimate.federal);
    expect(results.federal.withheldEstimated).toBe(true);
    expect(results.state.withheldEstimated).toBe(true);
    expect(results.selectedState).toBe("california");
  });

  it("keeps withholding that was entered", () => {
    const inputs = createDefaultInputs({
      selectedState: "california",
      federalIncome: 200000,
      federalTaxWithheld: 50000,
      stateTaxWithheld: 15000,
    });

    const { results, resolvedInputs } = calculateEstimate(
      inputs,
      federalData,
      dataFor("california"),
    );

    expect(resolvedInputs).toEqual(inputs);
    expect(results.federal.withheld).toBe(50000);
    expect(results.federal.withheldEstimated).toBe(false);
    expect(results.state.withheld).toBe(15000);
    expect(results.state.withheldEstimated).toBe(false);
  });

  it("leaves state withholding blank where the state's is not modelled", () => {
    const inputs = createDefaultInputs({
      selectedState: "dc",
      federalIncome: 200000,
    });

    const { results, withholdingEstimate } = calculateEstimate(
      inputs,
      federalData,
      dataFor("dc"),
    );

    expect(withholdingEstimate.state).toBeNull();
    expect(results.state.withheld).toBe(0);
    expect(results.state.withheldEstimated).toBe(false);
  });
});

describe("calculateCharitableScenario", () => {
  it("replaces the charitable amount and reports what limited the deduction", () => {
    const inputs = createDefaultInputs({
      selectedState: "california",
      federalIncome: 300000,
      propertyTaxesPaid: 12000,
      mortgageInterestPaid: 20000,
      mortgageBalance: 500000,
      charitableContributions: 5000,
    });
    const data = dataFor("california");

    const noGiving = calculateCharitableScenario(inputs, 0, federalData, data);
    const giving = calculateCharitableScenario(inputs, 20000, federalData, data);

    expect(giving.federalTax).toBeLessThan(noGiving.federalTax);
    expect(giving.stateTax).toBeLessThan(noGiving.stateTax);
    expect(giving.federalItemizes).toBe(true);
    // 0.5% of AGI ($300,000) = $1,500 of giving is under the floor
    expect(giving.federalFloor).toBe(1500);
    expect(giving.federalTax).toBe(
      calculateTaxes(
        { ...inputs, charitableContributions: 20000 },
        federalData,
        data,
      ).federal.totalTax,
    );
  });
});

describe("filing status comparison", () => {
  const joint = createDefaultInputs({
    selectedState: "california",
    filingStatus: "marriedFilingJointly",
    federalIncome: 400000,
    longTermCapitalGains: 100000,
    federalTaxWithheld: 80000,
  });
  const evenSplit = {
    wages: 50,
    stcg: 50,
    ltcg: 50,
    dividends: 50,
    contributions401k: 50,
    preTaxMedical: 50,
    deductions: 50,
  };

  it("totals federal and state tax on the joint return", () => {
    const result = calculateJointScenario(
      joint,
      federalData,
      dataFor("california"),
    );
    const { federal, state } = calculateTaxes(
      joint,
      federalData,
      dataFor("california"),
    );

    expect(result).toEqual({
      federalTax: federal.totalTax,
      stateTax: state.totalTax,
      totalTax: federal.totalTax + state.totalTax,
    });
  });

  it("adds two separate returns, each on its share of the joint figures", () => {
    const data = dataFor("california");

    const result = calculateMFSScenario(joint, evenSplit, federalData, data);

    // An even split gives two identical returns
    expect(result.spouse1).toEqual(result.spouse2);
    expect(result.combined.federalTax).toBe(
      result.spouse1.federalTax + result.spouse2.federalTax,
    );
    expect(result.combined.totalTax).toBe(
      result.combined.federalTax + result.combined.stateTax,
    );
    // Each separate return taxes half the wages
    const half = calculateTaxes(
      {
        ...joint,
        filingStatus: "marriedFilingSeparately",
        federalIncome: 200000,
        longTermCapitalGains: 50000,
        federalTaxWithheld: 40000,
      },
      federalData,
      data,
    );
    expect(result.spouse1.federalTax).toBe(half.federal.totalTax);
  });
});
