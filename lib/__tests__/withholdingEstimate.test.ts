import { describe, it, expect } from "vitest";
import {
  applyWithholdingEstimate,
  estimateWithholding,
  WithholdingEstimate,
} from "../withholdingEstimate";
import { StateData } from "../stateData";
import { TaxInputs } from "../types";
import {
  californiaBrackets,
  californiaDeductions,
  californiaLimits,
  createDefaultInputs,
  federalBrackets,
  federalDeductions,
  federalLimits,
} from "./testData";

// Figures used throughout (2026, the default tax year):
//
// Federal ordinary schedule, single: 10% to $12,400, 12% to $50,400, 22% to
//   $105,700, 24% to $201,775; standard deduction $16,100 ($32,200 joint)
// Federal supplemental withholding: 22% on the first $1,000,000 of bonuses and
//   stock in the year, 37% above
// California schedule, single: 1% to $11,456, 2% to $27,157, 4% to $42,861,
//   6% to $59,498, 8% to $75,197, 9.3% to $384,109; tax at $75,197 is
//   $3,310.88; standard deduction $5,900
// California supplemental withholding: 10.23% on bonuses and stock

const federalData = { federalBrackets, federalDeductions, federalLimits };
const california: StateData = {
  brackets: californiaBrackets,
  deductions: californiaDeductions,
  limits: californiaLimits,
};

const estimate = (
  overrides: Partial<TaxInputs> = {},
  stateData: StateData | undefined = california,
) => estimateWithholding(createDefaultInputs(overrides), federalData, stateData);

describe("estimateWithholding", () => {
  describe("federal", () => {
    it("withholds on regular wages by the annual schedule after pre-tax deductions and the standard deduction", () => {
      // Regular wages $300,000 - $100,000 bonus - $24,500 401(k) = $175,500;
      // less $16,100 = $159,400 taxable:
      //   10% x 12,400 = 1,240; 12% x 38,000 = 4,560; 22% x 55,300 = 12,166;
      //   24% x (159,400 - 105,700) = 24% x 53,700 = 12,888 -> 30,854
      // Bonus: 22% x 100,000 = 22,000. Total 52,854.
      const result = estimate({
        federalIncome: 300000,
        supplementalWages: 100000,
        contributions401k: 24500,
      });

      expect(result.federalRegular).toBeCloseTo(30854, 2);
      expect(result.federalSupplemental).toBe(22000);
      expect(result.federal).toBeCloseTo(52854, 2);
    });

    it("withholds 37% on bonuses and stock above $1,000,000 in the year", () => {
      // Regular $200,000 - $16,100 = $183,900:
      //   1,240 + 4,560 + 12,166 + 24% x (183,900 - 105,700) = 18,768 -> 36,734
      // Supplemental $1,500,000: 22% x 1,000,000 = 220,000 + 37% x 500,000 =
      //   185,000 -> 405,000. Total 441,734.
      const result = estimate({
        federalIncome: 1700000,
        supplementalWages: 1500000,
      });

      expect(result.federalRegular).toBeCloseTo(36734, 2);
      expect(result.federalSupplemental).toBe(405000);
      expect(result.federal).toBeCloseTo(441734, 2);
    });

    it("uses the joint schedule and standard deduction for a joint return", () => {
      // $100,000 - $32,200 = $67,800: 10% x 24,800 = 2,480; 12% x 43,000 =
      // 5,160 -> 7,640
      const result = estimate({
        federalIncome: 100000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.federal).toBeCloseTo(7640, 2);
      expect(result.federalSupplemental).toBe(0);
    });

    it("treats bonuses and stock above wages as all of the wages", () => {
      // Supplemental is a portion of wages: $120,000 against $100,000 of wages
      // is $100,000 of supplemental and no regular wages
      const result = estimate({
        federalIncome: 100000,
        supplementalWages: 120000,
      });

      expect(result.federalRegular).toBe(0);
      expect(result.federalSupplemental).toBe(22000);
    });

    it("is zero without wages", () => {
      expect(estimate().federal).toBe(0);
    });
  });

  describe("California", () => {
    it("withholds on regular wages by the state schedule and 10.23% on bonuses and stock", () => {
      // Regular $300,000 - $100,000 - $24,500 = $175,500; less $5,900 =
      // $169,600: 3,310.88 + 9.3% x (169,600 - 75,197) = 9.3% x 94,403 =
      // 8,779.479 -> 12,090.359. Bonus: 10.23% x 100,000 = 10,230.
      const result = estimate({
        federalIncome: 300000,
        supplementalWages: 100000,
        contributions401k: 24500,
      });

      expect(result.stateRegular).toBeCloseTo(12090.359, 2);
      expect(result.stateSupplemental).toBeCloseTo(10230, 2);
      expect(result.state).toBeCloseTo(22320.359, 2);
    });

    it("works from the state wages when they differ from federal", () => {
      // State wages $250,000 - $100,000 bonus = $150,000; less $5,900 =
      // $144,100: 3,310.88 + 9.3% x (144,100 - 75,197) = 9.3% x 68,903 =
      // 6,407.979 -> 9,718.859
      const result = estimate({
        federalIncome: 300000,
        stateIncome: 250000,
        supplementalWages: 100000,
      });

      expect(result.stateRegular).toBeCloseTo(9718.859, 2);
      expect(result.stateSupplemental).toBeCloseTo(10230, 2);
    });

    it("is not estimated for other states or before the state data has loaded", () => {
      expect(
        estimate({ federalIncome: 300000, selectedState: "newyork" }).state,
      ).toBeNull();
      const beforeLoad = estimateWithholding(
        createDefaultInputs({ federalIncome: 300000 }),
        federalData,
        undefined,
      );
      expect(beforeLoad.state).toBeNull();
      expect(beforeLoad.federal).toBeGreaterThan(0);
    });
  });
});

describe("applyWithholdingEstimate", () => {
  const withholding: WithholdingEstimate = {
    federal: 52854,
    federalRegular: 30854,
    federalSupplemental: 22000,
    state: 22320,
    stateRegular: 12090,
    stateSupplemental: 10230,
  };

  it("stands in for withholding that was left blank", () => {
    const resolved = applyWithholdingEstimate(
      createDefaultInputs({ federalIncome: 300000 }),
      withholding,
    );

    expect(resolved.inputs.federalTaxWithheld).toBe(52854);
    expect(resolved.inputs.stateTaxWithheld).toBe(22320);
    expect(resolved.federalEstimated).toBe(true);
    expect(resolved.stateEstimated).toBe(true);
  });

  it("keeps an amount the user entered", () => {
    const resolved = applyWithholdingEstimate(
      createDefaultInputs({
        federalIncome: 300000,
        federalTaxWithheld: 60000,
        stateTaxWithheld: 20000,
      }),
      withholding,
    );

    expect(resolved.inputs.federalTaxWithheld).toBe(60000);
    expect(resolved.inputs.stateTaxWithheld).toBe(20000);
    expect(resolved.federalEstimated).toBe(false);
    expect(resolved.stateEstimated).toBe(false);
  });

  it("leaves state withholding alone where it is not estimated", () => {
    const resolved = applyWithholdingEstimate(
      createDefaultInputs({ federalIncome: 300000 }),
      { ...withholding, state: null, stateRegular: 0, stateSupplemental: 0 },
    );

    expect(resolved.inputs.stateTaxWithheld).toBe(0);
    expect(resolved.stateEstimated).toBe(false);
  });

  it("does not flag an estimate of zero", () => {
    const resolved = applyWithholdingEstimate(createDefaultInputs(), {
      ...withholding,
      federal: 0,
      state: 0,
    });

    expect(resolved.federalEstimated).toBe(false);
    expect(resolved.stateEstimated).toBe(false);
    expect(resolved.inputs).toEqual(createDefaultInputs());
  });

  it("does not change the other inputs", () => {
    const inputs = createDefaultInputs({
      federalIncome: 300000,
      charitableContributions: 5000,
    });

    const resolved = applyWithholdingEstimate(inputs, withholding);

    expect(resolved.inputs).toEqual({
      ...inputs,
      federalTaxWithheld: 52854,
      stateTaxWithheld: 22320,
    });
  });
});
