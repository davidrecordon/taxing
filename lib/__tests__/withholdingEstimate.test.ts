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
  californiaWithholding,
  coloradoBrackets,
  coloradoLimits,
  coloradoWithholding,
  createDefaultInputs,
  federalBrackets,
  federalDeductions,
  federalLimits,
  illinoisBrackets,
  illinoisDeductions,
  illinoisLimits,
  illinoisWithholding,
  newYorkBrackets,
  newYorkDeductions,
  newYorkLimits,
  newYorkWithholding,
  nycWithholding,
} from "./testData";

// Figures used throughout (2026, the default tax year):
//
// Federal ordinary schedule, single: 10% to $12,400, 12% to $50,400, 22% to
//   $105,700, 24% to $201,775; standard deduction $16,100 ($32,200 joint)
// Federal supplemental withholding: 22% on the first $1,000,000 of bonuses and
//   stock in the year, 37% above
// California employer withholding (EDD Method B, 2026 edition), single:
//   1.1% to $11,079, 2.2% to $26,264, 4.4% to $41,452, 6.6% to $57,542,
//   8.8% to $72,724, 10.23% to $371,479; withholding at $72,724 is $3,522.17;
//   standard deduction $5,706; no withholding at or below $18,896 of wages;
//   $168.30 credit per allowance, none assumed for a single filer
// California Method B, married: 1.1% to $22,158, 2.2% to $52,528, 4.4% to
//   $82,904, 6.6% to $115,084; withholding at $82,904 is $2,248.42; standard
//   deduction $11,412; two allowances assumed ($336.60 credit)
// California supplemental withholding: 10.23% on bonuses and stock
// Colorado employer withholding (DR 1098, 2026): 4.40% of wages less $5,500
//   ($11,000 joint); no separate rate on bonuses and stock
// Illinois employer withholding (IL-700-T, 2026): 4.95% of wages less $2,925
//   per allowance, one assumed ($5,850 for two on a joint return); no separate
//   rate on bonuses and stock
// New York employer withholding (NYS-50-T-NYS 1/26, Method II annual
//   schedule) on wages less $7,400 ($7,950 married), no exemptions: single
//   3.9% to $8,500, 4.4% to $11,700, 5.15% to $13,900, 5.4% to $80,650, 5.9%
//   to $96,800, 7.03% to $107,650, 7.53% to $157,650, 6.4% to $215,400, 11.44%
//   to $265,400, 7.35% to $1,077,550; the walk reaches $157,650 at $9,670.705
//   and $265,400 at $19,086.705. Married: 5.9% to $96,800 as single, then
//   6.57%, 7.07%, 8.01% to $211,550, ... Method III from $1,077,550 of net
//   wages (single): 10.45% of all of them. Supplemental 11.70%.
// New York City (NYS-50-T-NYC 1/26) on wages less $5,000 ($5,500 married):
//   2.05% to $8,000, 2.8% to $8,700, 3.25% to $15,000, 3.95% to $25,000, 4.15%
//   to $60,000, 4.25% above; the walk reaches $60,000 at $2,235.85.
//   Supplemental 4.25%.

const federalData = { federalBrackets, federalDeductions, federalLimits };
const california: StateData = {
  brackets: californiaBrackets,
  deductions: californiaDeductions,
  limits: californiaLimits,
  withholding: californiaWithholding,
};

const colorado: StateData = {
  brackets: coloradoBrackets,
  limits: coloradoLimits,
  withholding: coloradoWithholding,
};
const illinois: StateData = {
  brackets: illinoisBrackets,
  deductions: illinoisDeductions,
  limits: illinoisLimits,
  withholding: illinoisWithholding,
};

const newYork: StateData = {
  brackets: newYorkBrackets,
  deductions: newYorkDeductions,
  limits: newYorkLimits,
  withholding: newYorkWithholding,
  nycWithholding,
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

    it("withholds on each earner's wages separately on a joint return with spouse wages", () => {
      // $300,000 of wages, $100,000 of them the spouse's; $30,000 of bonuses
      // and $24,000 of 401(k) divided two thirds and one third, as the wages
      // are. Each employer uses the joint schedule and deduction.
      //   First earner: $200,000 - $20,000 - $16,000 = $164,000 regular,
      //     less $32,200 = $131,800: 2,480 + 9,120 + 22% x 31,000 (6,820)
      //     -> 18,420
      //   Spouse: $100,000 - $10,000 - $8,000 = $82,000, less $32,200 =
      //     $49,800: 2,480 + 12% x 25,000 (3,000) -> 5,480
      //   Bonuses: 22% x 30,000 = 6,600 whoever was paid them
      // One earner on the same figures: $246,000 - $32,200 = $213,800:
      //   2,480 + 9,120 + 24,332 + 24% x 2,400 (576) -> 36,508 + 6,600
      const twoEarners = estimate({
        federalIncome: 300000,
        spouseWages: 100000,
        supplementalWages: 30000,
        contributions401k: 24000,
        filingStatus: "marriedFilingJointly",
      });
      const oneEarner = estimate({
        federalIncome: 300000,
        supplementalWages: 30000,
        contributions401k: 24000,
        filingStatus: "marriedFilingJointly",
      });

      expect(twoEarners.federalRegular).toBeCloseTo(23900, 2);
      expect(twoEarners.federalSupplemental).toBeCloseTo(6600, 2);
      expect(twoEarners.federal).toBeCloseTo(30500, 2);
      expect(oneEarner.federal).toBeCloseTo(43108, 2);
    });

    it("ignores spouse wages unless the return is joint", () => {
      expect(
        estimate({ federalIncome: 300000, spouseWages: 100000 }).federal,
      ).toBe(estimate({ federalIncome: 300000 }).federal);
    });
  });

  describe("California", () => {
    it("withholds on regular wages by the Method B schedule and 10.23% on bonuses and stock", () => {
      // Regular $300,000 - $100,000 - $24,500 = $175,500; less $5,706 =
      // $169,794: 3,522.17 + 10.23% x (169,794 - 72,724) = 10.23% x 97,070 =
      // 9,930.261 -> 13,452.431; no allowance credit. Bonus: 10.23% x
      // 100,000 = 10,230.
      const result = estimate({
        federalIncome: 300000,
        supplementalWages: 100000,
        contributions401k: 24500,
      });

      expect(result.stateRegular).toBeCloseTo(13452.431, 2);
      expect(result.stateSupplemental).toBeCloseTo(10230, 2);
      expect(result.state).toBeCloseTo(23682.431, 2);
    });

    it("works from the state wages when they differ from federal", () => {
      // State wages $250,000 - $100,000 bonus = $150,000; less $5,706 =
      // $144,294: 3,522.17 + 10.23% x (144,294 - 72,724) = 10.23% x 71,570 =
      // 7,321.611 -> 10,843.781
      const result = estimate({
        federalIncome: 300000,
        stateIncome: 250000,
        supplementalWages: 100000,
      });

      expect(result.stateRegular).toBeCloseTo(10843.781, 2);
      expect(result.stateSupplemental).toBeCloseTo(10230, 2);
    });

    it("uses the married schedule, deduction and two allowances for a joint return", () => {
      // $100,000 less $11,412 = $88,588: 2,248.42 + 6.6% x (88,588 - 82,904)
      // = 6.6% x 5,684 = 375.144 -> 2,623.564; less two allowances at
      // $168.30 = 336.60 -> 2,286.964
      const result = estimate({
        federalIncome: 100000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.stateRegular).toBeCloseTo(2286.964, 2);
    });

    it("withholds nothing at or below the low-income line, and from the first dollar above it", () => {
      expect(estimate({ federalIncome: 18896 }).stateRegular).toBe(0);
      // $18,897 less $5,706 = $13,191: 121.87 + 2.2% x (13,191 - 11,079) =
      // 2.2% x 2,112 = 46.464 -> 168.334
      expect(estimate({ federalIncome: 18897 }).stateRegular).toBeCloseTo(
        168.334,
        2,
      );
    });
  });

  describe("Colorado", () => {
    const colo = (overrides: Partial<TaxInputs> = {}) =>
      estimate({ selectedState: "colorado", ...overrides }, colorado);

    it("withholds the flat rate on wages less the standard allowance", () => {
      // ($150,000 - $5,500) x 4.4% = 6,358
      const result = colo({ federalIncome: 150000 });

      expect(result.stateRegular).toBeCloseTo(6358, 2);
      expect(result.stateSupplemental).toBe(0);
      expect(result.state).toBeCloseTo(6358, 2);
    });

    it("withholds on bonuses and stock at the same rate, after the allowance", () => {
      // Regular $130,000 - $5,500 = $124,500 x 4.4% = 5,478; bonus $20,000 x
      // 4.4% = 880; the total is 4.4% of all wages less the allowance
      const result = colo({ federalIncome: 150000, supplementalWages: 20000 });

      expect(result.stateRegular).toBeCloseTo(5478, 2);
      expect(result.stateSupplemental).toBeCloseTo(880, 2);
      expect(result.state).toBeCloseTo(6358, 2);
    });

    it("uses the joint allowance for a joint return and the state wages when they differ", () => {
      // ($150,000 - $11,000) x 4.4% = 6,116
      expect(
        colo({ federalIncome: 150000, filingStatus: "marriedFilingJointly" })
          .state,
      ).toBeCloseTo(6116, 2);
      // ($120,000 - $5,500) x 4.4% = 5,038
      expect(
        colo({ federalIncome: 150000, stateIncome: 120000 }).state,
      ).toBeCloseTo(5038, 2);
    });

    it("withholds nothing at or below the allowance", () => {
      expect(colo({ federalIncome: 5500 }).state).toBe(0);
    });
  });

  describe("Illinois", () => {
    const ill = (overrides: Partial<TaxInputs> = {}) =>
      estimate({ selectedState: "illinois", ...overrides }, illinois);

    it("withholds the flat rate on wages less one allowance, bonuses and stock included", () => {
      // Regular $300,000 - $100,000 - $24,500 = $175,500; less $2,925 =
      // $172,575 x 4.95% = 8,542.4625; bonus $100,000 x 4.95% = 4,950 ->
      // 13,492.4625
      const result = ill({
        federalIncome: 300000,
        supplementalWages: 100000,
        contributions401k: 24500,
      });

      expect(result.stateRegular).toBeCloseTo(8542.4625, 2);
      expect(result.stateSupplemental).toBeCloseTo(4950, 2);
      expect(result.state).toBeCloseTo(13492.4625, 2);
    });

    it("assumes two allowances for a joint return", () => {
      // ($100,000 - $5,850) x 4.95% = 4,660.425
      expect(
        ill({ federalIncome: 100000, filingStatus: "marriedFilingJointly" })
          .state,
      ).toBeCloseTo(4660.425, 2);
    });

    it("takes the allowance off regular wages first, then bonuses and stock", () => {
      // $1,000 of regular wages is under the $2,925 allowance, so the rest of
      // it comes off the $9,000 bonus: ($10,000 - $2,925) x 4.95% = 350.2125
      const result = ill({ federalIncome: 10000, supplementalWages: 9000 });

      expect(result.stateRegular).toBe(0);
      expect(result.stateSupplemental).toBeCloseTo(350.2125, 2);
    });
  });

  describe("New York", () => {
    const ny = (overrides: Partial<TaxInputs> = {}) =>
      estimate({ selectedState: "newyork", ...overrides }, newYork);

    it("withholds on regular wages by the Method II annual schedule and 11.70% on bonuses and stock", () => {
      // Regular $300,000 - $100,000 - $24,500 = $175,500; less $7,400 =
      // $168,100 net wages: 9,670.705 + 6.4% x (168,100 - 157,650) = 6.4% x
      // 10,450 = 668.8 -> 10,339.505. Bonus: 11.7% x 100,000 = 11,700.
      const result = ny({
        federalIncome: 300000,
        supplementalWages: 100000,
        contributions401k: 24500,
      });

      expect(result.stateRegular).toBeCloseTo(10339.505, 2);
      expect(result.stateSupplemental).toBeCloseTo(11700, 2);
      expect(result.state).toBeCloseTo(22039.505, 2);
    });

    it("adds the city's Method II and 4.25% for a city resident", () => {
      // City: $175,500 less $5,000 = $170,500 net wages: 2,235.85 + 4.25% x
      // (170,500 - 60,000) = 4.25% x 110,500 = 4,696.25 -> 6,932.10; bonus
      // 4.25% x 100,000 = 4,250. With the state: 10,339.505 + 6,932.10 =
      // 17,271.605 regular, 11,700 + 4,250 = 15,950 on the bonus.
      const result = ny({
        federalIncome: 300000,
        supplementalWages: 100000,
        contributions401k: 24500,
        isNYCResident: true,
      });

      expect(result.stateRegular).toBeCloseTo(17271.605, 2);
      expect(result.stateSupplemental).toBeCloseTo(15950, 2);
    });

    it("uses the married deduction and schedule for a joint return", () => {
      // $100,000 less $7,950 = $92,050: 331.5 + 140.8 + 113.3 + 3,604.5 +
      // 5.9% x (92,050 - 80,650) = 5.9% x 11,400 = 672.6 -> 4,862.7
      expect(
        ny({ federalIncome: 100000, filingStatus: "marriedFilingJointly" })
          .state,
      ).toBeCloseTo(4862.7, 2);
    });

    it("switches to Method III's flat share of all net wages at the threshold", () => {
      // Net wages $1,077,549: 19,086.705 + 7.35% x (1,077,549 - 265,400) =
      // 7.35% x 812,149 = 59,692.9515 -> 78,779.6565
      expect(ny({ federalIncome: 1084949 }).stateRegular).toBeCloseTo(
        78779.6565,
        2,
      );
      // Net wages $1,077,550: 10.45% of all of it = 112,603.975
      expect(ny({ federalIncome: 1084950 }).stateRegular).toBeCloseTo(
        112603.975,
        2,
      );
    });

    it("reproduces the booklets' cumulative column within their rounding", () => {
      // Column 5 of each annual schedule, as printed, is the tax at the top of
      // the row above it, accumulated from whole-dollar rounded steps, so it
      // can sit a few dollars off the exact walk
      const printed = (
        table: typeof newYorkWithholding,
        status: "single" | "marriedFilingJointly",
        column5: number[],
      ) => {
        table.brackets[status].slice(1).forEach((row, i) => {
          const walk = estimateWithholding(
            createDefaultInputs({
              selectedState: "newyork",
              filingStatus: status,
              federalIncome: row.min + table.deduction[status],
            }),
            federalData,
            { ...newYork, withholding: table, nycWithholding: undefined },
          ).stateRegular;
          expect(
            Math.abs(walk - column5[i]),
            `${status} ${row.min}`,
          ).toBeLessThan(5);
        });
      };
      printed(
        newYorkWithholding,
        "single",
        [332, 472, 586, 4190, 5143, 5906, 9673, 13369, 19091],
      );
      printed(
        newYorkWithholding,
        "marriedFilingJointly",
        [332, 472, 586, 4190, 5143, 5855, 9388, 13708, 20854, 27600, 79369],
      );
      printed(nycWithholding, "single", [164, 184, 388, 783, 2236]);
    });
  });

  describe("two earners", () => {
    it.each([
      ["california", california],
      ["colorado", colorado],
      ["illinois", illinois],
      ["newyork", newYork],
    ] as const)("%s: each employer withholds on its own employee's wages", (selectedState, stateData) => {
      // Two earners on $100,000 each, with state wages a tenth lower, come
      // to twice one earner on $100,000 and $90,000 of state wages
      const couple = estimate(
        {
          selectedState,
          federalIncome: 200000,
          stateIncome: 180000,
          spouseWages: 100000,
          filingStatus: "marriedFilingJointly",
          isNYCResident: true,
        },
        stateData,
      );
      const oneEarner = estimate(
        {
          selectedState,
          federalIncome: 100000,
          stateIncome: 90000,
          filingStatus: "marriedFilingJointly",
          isNYCResident: true,
        },
        stateData,
      );

      expect(couple.state).toBeCloseTo(oneEarner.state! * 2, 6);
      expect(couple.stateRegular).toBeCloseTo(oneEarner.stateRegular * 2, 6);
      expect(couple.federal).toBeCloseTo(oneEarner.federal * 2, 6);
    });
  });

  describe("other states", () => {
    it("is not estimated for other states or before the state data has loaded", () => {
      expect(
        estimate({ federalIncome: 300000, selectedState: "dc" }).state,
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
