import { describe, it, expect, beforeAll } from "vitest";
import {
  calculateNewYorkTax,
  calculateNYCSchoolTaxCredit,
  calculateTaxBenefitRecapture,
} from "../states/newYorkTaxCalculator";
import { calculateTaxByBrackets } from "../taxUtils";
import { FilingStatus, TaxInputs } from "../types";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import {
  newYorkBrackets,
  nycBrackets,
  newYorkDeductions,
  newYorkLimits,
  sharedLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

// New York rate schedules for the default tax year (2026), with the tax at
// the top of each bracket. The comments in the tests below refer to these.
//
// Single and married filing separately:
//   $0 - $8,500 @ 3.9%                   $331.50        total $331.50
//   $8,500 - $11,700 @ 4.4%              $140.80        total $472.30
//   $11,700 - $13,900 @ 5.15%            $113.30        total $585.60
//   $13,900 - $80,650 @ 5.4%             $3,604.50      total $4,190.10
//   $80,650 - $215,400 @ 5.9%            $7,950.25      total $12,140.35
//   $215,400 - $1,077,550 @ 6.85%        $59,057.275    total $71,197.625
//   $1,077,550 - $5,000,000 @ 9.65%      $378,516.425   total $449,714.05
//   $5,000,000 - $25,000,000 @ 10.3%     $2,060,000     total $2,509,714.05
//   over $25,000,000 @ 10.9%
//
// Married filing jointly:
//   $0 - $17,150 @ 3.9%                  $668.85        total $668.85
//   $17,150 - $23,600 @ 4.4%             $283.80        total $952.65
//   $23,600 - $27,900 @ 5.15%            $221.45        total $1,174.10
//   $27,900 - $161,550 @ 5.4%            $7,217.10      total $8,391.20
//   $161,550 - $323,200 @ 5.9%           $9,537.35      total $17,928.55
//   $323,200 - $2,155,350 @ 6.85%        $125,502.275   total $143,430.825
//   $2,155,350 - $5,000,000 @ 9.65%      $274,508.725   total $417,939.55
//   $5,000,000 - $25,000,000 @ 10.3%     $2,060,000     total $2,477,939.55
//   over $25,000,000 @ 10.9%
//
// New York City, single and married filing separately:
//   $0 - $12,000 @ 3.078%                $369.36        total $369.36
//   $12,000 - $25,000 @ 3.762%           $489.06        total $858.42
//   $25,000 - $50,000 @ 3.819%           $954.75        total $1,813.17
//   over $50,000 @ 3.876%
//
// New York City, married filing jointly:
//   $0 - $21,600 @ 3.078%                $664.848       total $664.848
//   $21,600 - $45,000 @ 3.762%           $880.308       total $1,545.156
//   $45,000 - $90,000 @ 3.819%           $1,718.55      total $3,263.706
//   over $90,000 @ 3.876%
//
// Standard deduction: $8,000 single and married filing separately, $16,050
// married filing jointly.

const calculate = (overrides: Partial<TaxInputs> = {}) =>
  calculateNewYorkTax(
    createDefaultInputs(overrides),
    newYorkBrackets,
    nycBrackets,
    newYorkDeductions,
    sharedLimits,
    newYorkLimits,
    ficaData,
  );

// Wages that leave the given taxable income after the standard deduction
const wagesFor = (taxableIncome: number, filingStatus: FilingStatus) =>
  taxableIncome + (filingStatus === "marriedFilingJointly" ? 16050 : 8000);

describe("calculateNewYorkTax", () => {
  describe("worked examples", () => {
    it("single, $100,000 of wages", () => {
      // NY AGI:             $100,000
      // Standard deduction:   $8,000
      // Taxable income:      $92,000
      //
      // Rate schedule: $4,190.10 on the first $80,650
      //   + ($92,000 - $80,650) x 5.9% = $11,350 x 5.9% = $669.65
      //   = $4,859.75
      // Recapture: none, NY AGI is not over $107,650
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.adjustedGrossIncome).toBe(100000);
      expect(result.deductionBreakdown.deductionAmount).toBe(8000);
      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4859.75, 2);
      expect(result.nyTaxBenefitRecapture).toBe(0);
      expect(result.totalTax).toBeCloseTo(4859.75, 2);
    });

    it("married filing jointly, $200,000 of wages, with recapture part-way through the second tier", () => {
      // NY AGI:             $200,000
      // Standard deduction:  $16,050
      // Taxable income:     $183,950
      //
      // Rate schedule: $8,391.20 on the first $161,550
      //   + ($183,950 - $161,550) x 5.9% = $22,400 x 5.9% = $1,321.60
      //   = $9,712.80
      // Recapture (taxable income over $161,550): $333 + $807 x fraction
      //   fraction = ($200,000 - $161,550) / $50,000 = 0.7690
      //   $333 + $807 x 0.7690 = $333 + $620.583 = $953.583
      // Total: $9,712.80 + $953.583 = $10,666.383
      const result = calculate({
        federalIncome: 200000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.taxableOrdinaryIncome).toBe(183950);
      expect(result.ordinaryIncomeTax).toBeCloseTo(9712.8, 2);
      expect(result.nyTaxBenefitRecapture).toBeCloseTo(953.583, 2);
      expect(result.totalTax).toBeCloseTo(10666.383, 2);
    });

    it("married filing separately, $208,000 of wages, with the first recapture tier fully phased in", () => {
      // NY AGI:             $208,000
      // Standard deduction:   $8,000
      // Taxable income:     $200,000
      //
      // Rate schedule (same as single): $4,190.10 on the first $80,650
      //   + ($200,000 - $80,650) x 5.9% = $119,350 x 5.9% = $7,041.65
      //   = $11,231.75
      // Recapture (taxable income not over $215,400, NY AGI over $157,650):
      //   the tax becomes a flat 5.9% of taxable income
      //   $200,000 x 5.9% = $11,800; $11,800 - $11,231.75 = $568.25
      // Total: $11,800
      const result = calculate({
        federalIncome: 208000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.taxableOrdinaryIncome).toBe(200000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(11231.75, 2);
      expect(result.nyTaxBenefitRecapture).toBeCloseTo(568.25, 2);
      expect(result.totalTax).toBeCloseTo(11800, 2);
    });

    it("single, $250,000 of wages, with recapture part-way through the second tier", () => {
      // NY AGI:             $250,000
      // Standard deduction:   $8,000
      // Taxable income:     $242,000
      //
      // Rate schedule: $12,140.35 on the first $215,400
      //   + ($242,000 - $215,400) x 6.85% = $26,600 x 6.85% = $1,822.10
      //   = $13,962.45
      // Recapture (taxable income over $215,400): $567 + $2,047 x fraction
      //   fraction = ($250,000 - $215,400) / $50,000 = 0.6920
      //   $567 + $2,047 x 0.6920 = $567 + $1,416.524 = $1,983.524
      // Total: $13,962.45 + $1,983.524 = $15,945.974
      const result = calculate({
        federalIncome: 250000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(242000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(13962.45, 2);
      expect(result.nyTaxBenefitRecapture).toBeCloseTo(1983.524, 2);
      expect(result.totalTax).toBeCloseTo(15945.974, 2);
    });

    it("single New York City resident, $100,000 of wages", () => {
      // Taxable income: $100,000 - $8,000 = $92,000
      //
      // New York State: $4,859.75 (first example), no recapture
      // New York City: $1,813.17 on the first $50,000
      //   + ($92,000 - $50,000) x 3.876% = $42,000 x 3.876% = $1,627.92
      //   = $3,441.09
      // School tax credit:
      //   fixed amount (NY AGI not over $250,000)           $63.00
      //   rate reduction: $21 + ($92,000 - $12,000) x 0.228%
      //     = $21 + $182.40                                $203.40
      //   = $266.40
      // Total: $4,859.75 + $3,441.09 - $266.40 = $8,034.44
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4859.75, 2);
      expect(result.nyTaxBenefitRecapture).toBe(0);
      expect(result.nycTax).toBeCloseTo(3441.09, 2);
      expect(result.nycSchoolTaxCredit).toBeCloseTo(266.4, 2);
      expect(result.totalTax).toBeCloseTo(8034.44, 2);
    });
  });

  describe("New York State rate schedule", () => {
    // [taxable income, tax]: the top of each bracket, then $5,000,000 into
    // the top bracket
    const singleSchedule: [number, number][] = [
      [8500, 331.5], // $8,500 x 3.9%
      [11700, 472.3], // + $3,200 x 4.4% = $140.80
      [13900, 585.6], // + $2,200 x 5.15% = $113.30
      [80650, 4190.1], // + $66,750 x 5.4% = $3,604.50
      [215400, 12140.35], // + $134,750 x 5.9% = $7,950.25
      [1077550, 71197.625], // + $862,150 x 6.85% = $59,057.275
      [5000000, 449714.05], // + $3,922,450 x 9.65% = $378,516.425
      [25000000, 2509714.05], // + $20,000,000 x 10.3% = $2,060,000
      [30000000, 3054714.05], // + $5,000,000 x 10.9% = $545,000
    ];

    describe.each<FilingStatus>(["single", "marriedFilingSeparately"])(
      "%s",
      (filingStatus) => {
        it.each(singleSchedule)(
          "taxes $%s of taxable income at $%s",
          (taxableIncome, expected) => {
            const result = calculate({
              federalIncome: wagesFor(taxableIncome, filingStatus),
              filingStatus,
            });

            expect(result.taxableOrdinaryIncome).toBe(taxableIncome);
            expect(result.ordinaryIncomeTax).toBeCloseTo(expected, 2);
          },
        );
      },
    );

    it.each([
      [17150, 668.85], // $17,150 x 3.9%
      [23600, 952.65], // + $6,450 x 4.4% = $283.80
      [27900, 1174.1], // + $4,300 x 5.15% = $221.45
      [161550, 8391.2], // + $133,650 x 5.4% = $7,217.10
      [323200, 17928.55], // + $161,650 x 5.9% = $9,537.35
      [2155350, 143430.825], // + $1,832,150 x 6.85% = $125,502.275
      [5000000, 417939.55], // + $2,844,650 x 9.65% = $274,508.725
      [25000000, 2477939.55], // + $20,000,000 x 10.3% = $2,060,000
      [30000000, 3022939.55], // + $5,000,000 x 10.9% = $545,000
    ])(
      "marriedFilingJointly taxes $%s of taxable income at $%s",
      (taxableIncome, expected) => {
        const result = calculate({
          federalIncome: wagesFor(taxableIncome, "marriedFilingJointly"),
          filingStatus: "marriedFilingJointly",
        });

        expect(result.taxableOrdinaryIncome).toBe(taxableIncome);
        expect(result.ordinaryIncomeTax).toBeCloseTo(expected, 2);
      },
    );

    it("reports the 10.9% top bracket in the breakdown above $25,000,000", () => {
      const result = calculate({
        federalIncome: wagesFor(30000000, "single"),
        filingStatus: "single",
      });

      const top = result.ordinaryIncomeBracketBreakdown.at(-1)!;
      expect(top.rate).toBe(0.109);
      expect(top.incomeInBracket).toBe(5000000);
    });
  });

  describe("all income is ordinary income", () => {
    it("taxes capital gains, interest and dividends on the one rate schedule", () => {
      // $50,000 wages + $10,000 short-term gains + $20,000 long-term gains
      //   + $5,000 interest + $7,000 dividends (qualified or not) = $92,000
      // Taxable income: $92,000 - $8,000 = $84,000
      // Tax: $4,190.10 + ($84,000 - $80,650) x 5.9% = $4,190.10 + $197.65
      //   = $4,387.75
      const result = calculate({
        federalIncome: 50000,
        shortTermCapitalGains: 10000,
        longTermCapitalGains: 20000,
        interestIncome: 5000,
        ordinaryDividends: 7000,
        qualifiedDividends: 4000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(92000);
      expect(result.taxableOrdinaryIncome).toBe(84000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4387.75, 2);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ltcgTax).toBe(0);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.totalTax).toBeCloseTo(4387.75, 2);
    });

    it("excludes U.S. Treasury interest", () => {
      // $90,000 wages + $10,000 interest, of which $4,000 is from Treasuries
      // NY AGI: $90,000 + ($10,000 - $4,000) = $96,000
      // Taxable income: $96,000 - $8,000 = $88,000
      const result = calculate({
        federalIncome: 90000,
        interestIncome: 10000,
        treasuryInterest: 4000,
        filingStatus: "single",
      });

      expect(result.interestIncome).toBe(6000);
      expect(result.adjustedGrossIncome).toBe(96000);
      expect(result.taxableOrdinaryIncome).toBe(88000);
    });
  });

  describe("tax benefit recapture", () => {
    // Recapture for a given NY AGI and taxable income. The rate schedule tax
    // matters only in the first tier and under the top-rate rule; the
    // comments give it where it is used.
    const recapture = (
      filingStatus: FilingStatus,
      agi: number,
      taxableIncome: number,
    ) =>
      calculateTaxBenefitRecapture(
        calculateTaxByBrackets(
          taxableIncome,
          newYorkBrackets.brackets[filingStatus],
        ).total,
        taxableIncome,
        agi,
        filingStatus,
        newYorkLimits,
      );

    describe("NY AGI threshold of $107,650", () => {
      it("adds nothing at exactly $107,650 of NY AGI", () => {
        expect(recapture("single", 107650, 99650)).toBe(0);
        expect(recapture("marriedFilingJointly", 107650, 91600)).toBe(0);
      });

      it("adds nothing below the threshold", () => {
        expect(recapture("single", 100000, 92000)).toBe(0);
      });

      it("is decided by NY AGI alone, whatever the taxable income", () => {
        // Called directly with taxable income in the second tier (over
        // $215,400), where there would otherwise be a $567 base. A real
        // return cannot have taxable income above its AGI, so the calculator
        // never gets here, but the function must still return nothing.
        expect(recapture("single", 107650, 300000)).toBe(0);
        expect(recapture("single", 50000, 300000)).toBe(0);
      });

      it("still adds nothing one dollar over, because the fraction rounds to 0.0000", () => {
        // $1 / $50,000 = 0.00002, which rounds to 0.0000
        expect(recapture("single", 107651, 99651)).toBe(0);
      });

      it("uses NY AGI, after pre-tax contributions, not gross income", () => {
        // $130,000 wages less $22,350 of 401(k) contributions = $107,650
        const result = calculate({
          federalIncome: 130000,
          contributions401k: 22350,
          filingStatus: "single",
        });

        expect(result.adjustedGrossIncome).toBe(107650);
        expect(result.nyTaxBenefitRecapture).toBe(0);
      });
    });

    describe("first tier: phasing toward a flat rate on all taxable income", () => {
      it("starts just above the threshold: $50 over is a fraction of 0.0010", () => {
        // Single, NY AGI $107,700, taxable income $99,700
        // Rate schedule: $4,190.10 + $19,050 x 5.9% = $5,314.05
        // Flat 5.9%: $99,700 x 5.9% = $5,882.30; difference $568.25
        // Fraction: $50 / $50,000 = 0.0010
        // $568.25 x 0.0010 = $0.56825
        expect(recapture("single", 107700, 99700)).toBeCloseTo(0.56825, 4);
      });

      it("phases in part-way: single at 5.9%", () => {
        // NY AGI $130,000, taxable income $122,000
        // Rate schedule: $4,190.10 + $41,350 x 5.9% = $6,629.75
        // Flat 5.9%: $122,000 x 5.9% = $7,198; difference $568.25
        // Fraction: ($130,000 - $107,650) / $50,000 = 0.4470
        // $568.25 x 0.4470 = $254.00775
        expect(recapture("single", 130000, 122000)).toBeCloseTo(254.00775, 2);
      });

      it("phases in part-way: married filing separately at 5.9%, as single", () => {
        // Same figures as the single case above
        expect(
          recapture("marriedFilingSeparately", 130000, 122000),
        ).toBeCloseTo(254.00775, 2);
      });

      it("phases in part-way: married filing jointly at 5.4%", () => {
        // NY AGI $150,000, taxable income $133,950
        // Rate schedule: $1,174.10 + $106,050 x 5.4% = $6,900.80
        // Flat 5.4%: $133,950 x 5.4% = $7,233.30; difference $332.50
        // Fraction: ($150,000 - $107,650) / $50,000 = 0.8470
        // $332.50 x 0.8470 = $281.6275
        expect(
          recapture("marriedFilingJointly", 150000, 133950),
        ).toBeCloseTo(281.6275, 2);
      });

      it("rounds the phase-in fraction to four decimal places", () => {
        // Single, NY AGI $120,022, taxable income $112,022
        // Rate schedule: $4,190.10 + $31,372 x 5.9% = $6,041.048
        // Flat 5.9%: $112,022 x 5.9% = $6,609.298; difference $568.25
        // Fraction: $12,372 / $50,000 = 0.24744, rounded to 0.2474
        // $568.25 x 0.2474 = $140.58505 (unrounded it would be $140.6078)
        expect(recapture("single", 120022, 112022)).toBeCloseTo(140.58505, 2);
      });

      it("is fully phased in at $157,650 of NY AGI", () => {
        // Single, taxable income $149,650: fraction $50,000 / $50,000 = 1
        // Rate schedule: $4,190.10 + $69,000 x 5.9% = $8,261.10
        // Flat 5.9%: $149,650 x 5.9% = $8,829.35; difference $568.25
        expect(recapture("single", 157650, 149650)).toBeCloseTo(568.25, 2);
      });

      it("makes the tax a flat 5.9% of taxable income once fully phased in", () => {
        // Single, NY AGI $200,000, taxable income $70,000
        // Rate schedule: $585.60 + ($70,000 - $13,900) x 5.4%
        //   = $585.60 + $3,029.40 = $3,615.00
        // Flat 5.9%: $70,000 x 5.9% = $4,130; recapture $515.00
        expect(recapture("single", 200000, 70000)).toBeCloseTo(515, 2);
      });
    });

    // Later tiers: recapture base + incremental benefit x fraction, where the
    // fraction is the NY AGI over the tier's taxable income threshold divided
    // by $50,000. A tier applies when taxable income is over its threshold.
    //
    // For each tier, in order:
    //   - taxable income exactly at the threshold: the tier below still
    //     applies (fully phased in, as NY AGI is $25,000 past this threshold)
    //   - one dollar over, NY AGI the same: the tier starts, fraction 0.0000
    //   - one dollar over, NY AGI $25,000 past the threshold: fraction 0.5
    //   - one dollar over, NY AGI $50,000 past the threshold: fraction 1
    // [NY AGI, taxable income, recapture]
    describe.each<FilingStatus>(["single", "marriedFilingSeparately"])(
      "later tiers, %s",
      (filingStatus) => {
        it.each([
          // Over $215,400: base $567, incremental benefit $2,047
          // At the threshold the first tier applies:
          //   $215,400 x 5.9% = $12,708.60, less $12,140.35 = $568.25
          [240400, 215400, 568.25],
          [215401, 215401, 567], // $567 + $2,047 x 0
          [240400, 215401, 1590.5], // $567 + $2,047 x 0.5 = $567 + $1,023.50
          [265400, 215401, 2614], // $567 + $2,047
          // Over $1,077,550: base $2,614, incremental benefit $30,172
          [1102550, 1077550, 2614], // tier below: $567 + $2,047
          [1077551, 1077551, 2614], // $2,614 + $30,172 x 0
          [1102550, 1077551, 17700], // $2,614 + $30,172 x 0.5 = $2,614 + $15,086
          [1127550, 1077551, 32786], // $2,614 + $30,172
          // Over $5,000,000: base $32,786, incremental benefit $32,500
          [5025000, 5000000, 32786], // tier below: $2,614 + $30,172
          [5000001, 5000001, 32786], // $32,786 + $32,500 x 0
          [5025000, 5000001, 49036], // $32,786 + $32,500 x 0.5 = $32,786 + $16,250
          [5050000, 5000001, 65286], // $32,786 + $32,500
        ])(
          "NY AGI $%s, taxable income $%s: $%s",
          (agi, taxableIncome, expected) => {
            expect(recapture(filingStatus, agi, taxableIncome)).toBeCloseTo(
              expected,
              2,
            );
          },
        );
      },
    );

    describe("later tiers, marriedFilingJointly", () => {
      it.each([
        // Over $161,550: base $333, incremental benefit $807
        // At the threshold the first tier applies:
        //   $161,550 x 5.4% = $8,723.70, less $8,391.20 = $332.50
        [186550, 161550, 332.5],
        [161551, 161551, 333], // $333 + $807 x 0
        [186550, 161551, 736.5], // $333 + $807 x 0.5 = $333 + $403.50
        [211550, 161551, 1140], // $333 + $807
        // Over $323,200: base $1,140, incremental benefit $3,071
        [348200, 323200, 1140], // tier below: $333 + $807
        [323201, 323201, 1140], // $1,140 + $3,071 x 0
        [348200, 323201, 2675.5], // $1,140 + $3,071 x 0.5 = $1,140 + $1,535.50
        [373200, 323201, 4211], // $1,140 + $3,071
        // Over $2,155,350: base $4,211, incremental benefit $60,350
        [2180350, 2155350, 4211], // tier below: $1,140 + $3,071
        [2155351, 2155351, 4211], // $4,211 + $60,350 x 0
        [2180350, 2155351, 34386], // $4,211 + $60,350 x 0.5 = $4,211 + $30,175
        [2205350, 2155351, 64561], // $4,211 + $60,350
        // Over $5,000,000: base $64,561, incremental benefit $32,500
        [5025000, 5000000, 64561], // tier below: $4,211 + $60,350
        [5000001, 5000001, 64561], // $64,561 + $32,500 x 0
        [5025000, 5000001, 80811], // $64,561 + $32,500 x 0.5 = $64,561 + $16,250
        [5050000, 5000001, 97061], // $64,561 + $32,500
      ])(
        "NY AGI $%s, taxable income $%s: $%s",
        (agi, taxableIncome, expected) => {
          expect(
            recapture("marriedFilingJointly", agi, taxableIncome),
          ).toBeCloseTo(expected, 2);
        },
      );
    });

    describe("top rate above $25,000,000 of NY AGI", () => {
      it("still uses the top tier at exactly $25,000,000 of NY AGI", () => {
        // Single, taxable income $24,992,000: $32,786 + $32,500
        expect(recapture("single", 25000000, 24992000)).toBeCloseTo(65286, 2);
      });

      it("taxes all taxable income at 10.9% one dollar over", () => {
        // Single, taxable income $24,992,000
        // Rate schedule: $449,714.05 + $19,992,000 x 10.3%
        //   = $449,714.05 + $2,059,176 = $2,508,890.05
        // Flat 10.9%: $24,992,000 x 10.9% = $2,724,128
        // Recapture: $2,724,128 - $2,508,890.05 = $215,237.95
        expect(recapture("single", 25000001, 24992000)).toBeCloseTo(
          215237.95,
          2,
        );
      });

      it("taxes all taxable income at 10.9%: single", () => {
        // NY AGI $30,008,000, taxable income $30,000,000
        // Rate schedule: $2,509,714.05 + $5,000,000 x 10.9% = $3,054,714.05
        // Flat 10.9%: $30,000,000 x 10.9% = $3,270,000
        // Recapture: $3,270,000 - $3,054,714.05 = $215,285.95
        expect(recapture("single", 30008000, 30000000)).toBeCloseTo(
          215285.95,
          2,
        );
      });

      it("taxes all taxable income at 10.9%: married filing jointly", () => {
        // NY AGI $30,000,000, taxable income $29,983,950
        // Rate schedule: $2,477,939.55 + $4,983,950 x 10.9%
        //   = $2,477,939.55 + $543,250.55 = $3,021,190.10
        // Flat 10.9%: $29,983,950 x 10.9% = $3,268,250.55
        // Recapture: $3,268,250.55 - $3,021,190.10 = $247,060.45
        expect(
          recapture("marriedFilingJointly", 30000000, 29983950),
        ).toBeCloseTo(247060.45, 2);
      });
    });

    it("adds nothing when taxable income is zero, whatever the NY AGI", () => {
      expect(recapture("single", 130000, 0)).toBe(0);
      expect(recapture("single", 200000, 0)).toBe(0);
      expect(recapture("single", 30000000, 0)).toBe(0);
    });

    it("is added to the New York total", () => {
      // Single, $300,000 of wages: taxable income $292,000
      // Rate schedule: $12,140.35 + ($292,000 - $215,400) x 6.85%
      //   = $12,140.35 + $5,247.10 = $17,387.45
      // Recapture: NY AGI is more than $50,000 over $215,400, so
      //   $567 + $2,047 = $2,614
      // Total: $17,387.45 + $2,614 = $20,001.45
      const result = calculate({
        federalIncome: 300000,
        filingStatus: "single",
      });

      expect(result.ordinaryIncomeTax).toBeCloseTo(17387.45, 2);
      expect(result.nyTaxBenefitRecapture).toBe(2614);
      expect(result.totalTax).toBeCloseTo(20001.45, 2);
    });
  });

  describe("New York City tax", () => {
    it("applies only to New York City residents", () => {
      // Single, $100,000 of wages: New York State tax of $4,859.75 only
      const notResident = calculate({
        federalIncome: 100000,
        isNYCResident: false,
      });
      const notStated = calculate({ federalIncome: 100000 });

      for (const result of [notResident, notStated]) {
        expect(result.nycTax).toBeUndefined();
        expect(result.nycBracketBreakdown).toBeUndefined();
        expect(result.totalTax).toBeCloseTo(4859.75, 2);
      }
    });

    // [taxable income, city tax]: the top of each bracket, then the top rate
    const singleCitySchedule: [number, number][] = [
      [12000, 369.36], // $12,000 x 3.078%
      [25000, 858.42], // + $13,000 x 3.762% = $489.06
      [50000, 1813.17], // + $25,000 x 3.819% = $954.75
      [100000, 3751.17], // + $50,000 x 3.876% = $1,938
      // No recapture on the city tax: + $950,000 x 3.876% = $36,822
      [1000000, 38635.17],
    ];

    describe.each<FilingStatus>(["single", "marriedFilingSeparately"])(
      "%s",
      (filingStatus) => {
        it.each(singleCitySchedule)(
          "taxes $%s of taxable income at $%s",
          (taxableIncome, expected) => {
            const result = calculate({
              federalIncome: wagesFor(taxableIncome, filingStatus),
              filingStatus,
              isNYCResident: true,
            });

            expect(result.taxableOrdinaryIncome).toBe(taxableIncome);
            expect(result.nycTax).toBeCloseTo(expected, 2);
          },
        );
      },
    );

    it.each([
      [21600, 664.848], // $21,600 x 3.078%
      [45000, 1545.156], // + $23,400 x 3.762% = $880.308
      [90000, 3263.706], // + $45,000 x 3.819% = $1,718.55
      [190000, 7139.706], // + $100,000 x 3.876% = $3,876
    ])(
      "marriedFilingJointly taxes $%s of taxable income at $%s",
      (taxableIncome, expected) => {
        const result = calculate({
          federalIncome: wagesFor(taxableIncome, "marriedFilingJointly"),
          filingStatus: "marriedFilingJointly",
          isNYCResident: true,
        });

        expect(result.taxableOrdinaryIncome).toBe(taxableIncome);
        expect(result.nycTax).toBeCloseTo(expected, 2);
      },
    );

    it("reports the city brackets used", () => {
      // Taxable income $20,000: $12,000 at 3.078%, then $8,000 at 3.762%
      const result = calculate({
        federalIncome: 28000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(
        result.nycBracketBreakdown!.map((bracket) => [
          bracket.rate,
          bracket.incomeInBracket,
        ]),
      ).toEqual([
        [0.03078, 12000],
        [0.03762, 8000],
      ]);
    });

    it("is zero, with no brackets, when a resident has no taxable income", () => {
      // $8,000 of wages less the $8,000 standard deduction
      const result = calculate({
        federalIncome: 8000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.nycTax).toBe(0);
      expect(result.nycBracketBreakdown).toEqual([]);
    });
  });

  describe("New York City school tax credit", () => {
    const credit = (
      filingStatus: FilingStatus,
      agi: number,
      taxableIncome: number,
    ) =>
      calculateNYCSchoolTaxCredit(
        taxableIncome,
        agi,
        filingStatus,
        newYorkLimits,
      );

    describe("fixed amount", () => {
      // Zero taxable income leaves no rate reduction amount
      it.each<[FilingStatus, number]>([
        ["single", 63],
        ["marriedFilingJointly", 125],
        ["marriedFilingSeparately", 63],
      ])("%s gets $%s", (filingStatus, expected) => {
        expect(credit(filingStatus, 100000, 0)).toBe(expected);
      });

      it("is allowed at exactly $250,000 of income", () => {
        // $63 + rate reduction of $21 + ($92,000 - $12,000) x 0.228%
        //   = $63 + $21 + $182.40 = $266.40
        expect(credit("single", 250000, 92000)).toBeCloseTo(266.4, 2);
      });

      it("is not allowed one dollar over $250,000 of income", () => {
        // Rate reduction only: $21 + $182.40 = $203.40
        expect(credit("single", 250001, 92000)).toBeCloseTo(203.4, 2);
      });
    });

    // Income over $250,000 keeps the fixed amount out of these figures
    describe("rate reduction amount", () => {
      it.each<[FilingStatus, number, number]>([
        // Single: 0.171% up to $12,000, then $21 + 0.228% of the excess
        ["single", 10000, 17.1], // $10,000 x 0.171%
        ["single", 12000, 20.52], // $12,000 x 0.171%
        ["single", 12001, 21.00228], // $21 + $1 x 0.228%
        ["single", 92000, 203.4], // $21 + $80,000 x 0.228% = $21 + $182.40
        // Married filing separately uses the single figures
        ["marriedFilingSeparately", 12000, 20.52],
        ["marriedFilingSeparately", 12001, 21.00228],
        ["marriedFilingSeparately", 92000, 203.4],
        // Joint: 0.171% up to $21,600, then $37 + 0.228% of the excess
        ["marriedFilingJointly", 20000, 34.2], // $20,000 x 0.171%
        ["marriedFilingJointly", 21600, 36.936], // $21,600 x 0.171%
        ["marriedFilingJointly", 21601, 37.00228], // $37 + $1 x 0.228%
        // $37 + $78,400 x 0.228% = $37 + $178.752
        ["marriedFilingJointly", 100000, 215.752],
      ])(
        "%s with $%s of taxable income gets $%s",
        (filingStatus, taxableIncome, expected) => {
          expect(credit(filingStatus, 300000, taxableIncome)).toBeCloseTo(
            expected,
            2,
          );
        },
      );

      it("is allowed at exactly $500,000 of taxable income", () => {
        // Single: $21 + ($500,000 - $12,000) x 0.228% = $21 + $1,112.64
        expect(credit("single", 520000, 500000)).toBeCloseTo(1133.64, 2);
        // Joint: $37 + ($500,000 - $21,600) x 0.228% = $37 + $1,090.752
        expect(credit("marriedFilingJointly", 520000, 500000)).toBeCloseTo(
          1127.752,
          2,
        );
      });

      it("is not allowed one dollar over $500,000 of taxable income", () => {
        expect(credit("single", 520000, 500001)).toBe(0);
        expect(credit("marriedFilingJointly", 520000, 500001)).toBe(0);
      });
    });

    it("measures the $250,000 limit against NY AGI, not gross income", () => {
      // Single resident, $258,000 wages less $8,000 of 401(k) contributions:
      // NY AGI $250,000, taxable income $242,000
      // $63 + $21 + ($242,000 - $12,000) x 0.228% = $63 + $21 + $524.40
      //   = $608.40
      const result = calculate({
        federalIncome: 258000,
        contributions401k: 8000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.adjustedGrossIncome).toBe(250000);
      expect(result.nycSchoolTaxCredit).toBeCloseTo(608.4, 2);
    });

    it("is limited to the city tax", () => {
      // Single resident, $9,000 of wages: taxable income $1,000
      // New York State tax: $1,000 x 3.9% = $39.00
      // City tax: $1,000 x 3.078% = $30.78
      // Credit before the limit: $63 + $1,000 x 0.171% = $64.71
      // Credit allowed: $30.78, so the total is the state tax alone
      const result = calculate({
        federalIncome: 9000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.nycTax).toBeCloseTo(30.78, 2);
      expect(result.nycSchoolTaxCredit).toBeCloseTo(30.78, 2);
      expect(result.totalTax).toBeCloseTo(39, 2);
    });

    it("is zero for a resident with no taxable income, as there is no city tax", () => {
      // $8,000 of wages less the $8,000 standard deduction; the $63 fixed
      // amount is limited to city tax of $0
      const result = calculate({
        federalIncome: 8000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.nycSchoolTaxCredit).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("applies only to New York City residents", () => {
      expect(
        calculate({ federalIncome: 100000, isNYCResident: false })
          .nycSchoolTaxCredit,
      ).toBeUndefined();
      expect(
        calculate({ federalIncome: 100000 }).nycSchoolTaxCredit,
      ).toBeUndefined();
    });
  });

  describe("safe harbor", () => {
    // Single, $100,000 of wages: New York tax of $4,859.75 (first worked
    // example), with $10,000 of tax last year
    const safeHarborFor = (overrides: Partial<TaxInputs>) =>
      calculate({
        federalIncome: 100000,
        filingStatus: "single",
        priorYearStateTax: 10000,
        ...overrides,
      }).safeHarbor!;

    it("requires 90% of this year's tax", () => {
      // $4,859.75 x 90% = $4,373.775
      expect(safeHarborFor({}).currentYear90Percent).toBeCloseTo(4373.775, 2);
    });

    it("requires 110% of last year's tax when last year's income was over $150,000", () => {
      const safeHarbor = safeHarborFor({ priorYearIncomeOverThreshold: true });

      // $10,000 x 110%
      expect(safeHarbor.priorYearPercent).toBe(1.1);
      expect(safeHarbor.priorYearSafeHarbor).toBeCloseTo(11000, 2);
    });

    it("requires 100% of last year's tax when last year's income was not over $150,000", () => {
      // The test is on last year's income: this year's is $300,000 here
      const safeHarbor = safeHarborFor({
        federalIncome: 300000,
        priorYearIncomeOverThreshold: false,
      });

      expect(safeHarbor.priorYearPercent).toBe(1);
      expect(safeHarbor.priorYearSafeHarbor).toBe(10000);
    });

    it("assumes last year's income was over $150,000 when not stated", () => {
      // This year's income of $100,000 does not make it 100%
      const safeHarbor = safeHarborFor({});

      expect(safeHarbor.priorYearPercent).toBe(1.1);
      expect(safeHarbor.priorYearSafeHarbor).toBeCloseTo(11000, 2);
    });

    it("counts recapture and the city tax in this year's tax", () => {
      // Single resident, $130,000 of wages: taxable income $122,000
      // New York State: $6,629.75 + recapture of $254.00775
      // City tax: $1,813.17 + $72,000 x 3.876% = $1,813.17 + $2,790.72
      //   = $4,603.89
      // School tax credit: $63 + $21 + $110,000 x 0.228% = $334.80
      // Total: $6,629.75 + $254.00775 + $4,603.89 - $334.80 = $11,152.84775
      // 90%: $10,037.562975
      const result = calculate({
        federalIncome: 130000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.totalTax).toBeCloseTo(11152.84775, 2);
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        10037.562975,
        2,
      );
    });
  });

  describe("shared building blocks", () => {
    it("uses New York wages rather than federal wages when both are given", () => {
      // $120,000 of New York wages less the $8,000 standard deduction
      const result = calculate({
        federalIncome: 150000,
        stateIncome: 120000,
        filingStatus: "single",
      });

      expect(result.wageIncome).toBe(120000);
      expect(result.adjustedGrossIncome).toBe(120000);
      expect(result.taxableOrdinaryIncome).toBe(112000);
    });

    it("takes 401(k) and pre-tax medical contributions off NY AGI", () => {
      // $100,000 - $20,000 - $5,000 = $75,000; less $8,000 = $67,000
      const result = calculate({
        federalIncome: 100000,
        contributions401k: 20000,
        preTaxMedical: 5000,
        filingStatus: "single",
      });

      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.adjustedGrossIncome).toBe(75000);
      expect(result.taxableOrdinaryIncome).toBe(67000);
    });

    it("taxes self-employment income, less half the self-employment tax, for the state and the city", () => {
      // $100,000 wages + $50,000 self-employment income, city resident
      // Net earnings: $50,000 x 92.35% = $46,175
      // Self-employment tax: $46,175 x (12.4% + 2.9%) = $7,064.775
      // Deductible half: $3,532.3875
      // NY AGI: $150,000 - $3,532.3875 = $146,467.6125
      // Taxable income: $146,467.6125 - $8,000 = $138,467.6125
      // City tax: $1,813.17 + ($138,467.6125 - $50,000) x 3.876%
      //   = $1,813.17 + $3,429.00466 = $5,242.17466
      const result = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.grossIncome).toBe(150000);
      expect(result.selfEmploymentIncome).toBe(50000);
      expect(result.deductibleSETax).toBeCloseTo(3532.3875, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(138467.6125, 2);
      expect(result.nycTax).toBeCloseTo(5242.17466, 2);
    });

    it("nets capital losses before New York taxes the result", () => {
      // $5,000 short-term loss this year + $2,000 carried over = $7,000
      // $3,000 comes off other income and $4,000 carries forward
      // NY AGI: $100,000 - $3,000 = $97,000; less $8,000 = $89,000
      const result = calculate({
        federalIncome: 100000,
        shortTermCapitalGains: -5000,
        priorYearShortTermLossCarryover: 2000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(100000);
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(4000);
      expect(result.adjustedGrossIncome).toBe(97000);
      expect(result.taxableOrdinaryIncome).toBe(89000);
      // The loss as entered is passed through for display
      expect(result.shortTermCapitalGains).toBe(-5000);
    });

    it("uses New York's own itemized deductions", () => {
      // Single, NY AGI $200,000: $15,000 mortgage interest + $5,000 gifts
      //   = $20,000, less New York's 25% adjustment above $150,000 = $15,000
      // Taxable income: $200,000 - $15,000 = $185,000
      const result = calculate({
        federalIncome: 200000,
        mortgageInterestPaid: 15000,
        charitableContributions: 5000,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.highIncomeReduction).toBe(5000);
      expect(result.deductionBreakdown.deductionAmount).toBe(15000);
      expect(result.taxableOrdinaryIncome).toBe(185000);
    });

    it("compares New York withholding and estimated payments with the New York total", () => {
      // Single, $100,000 of wages: tax of $4,859.75
      // Paid: $4,000 withheld + $2,000 estimated = $6,000
      // Refund: $6,000 - $4,859.75 = $1,140.25
      const result = calculate({
        federalIncome: 100000,
        stateTaxWithheld: 4000,
        stateEstimatedPaid: 2000,
        filingStatus: "single",
      });

      expect(result.withheld).toBe(4000);
      expect(result.estimatedPaid).toBe(2000);
      expect(result.totalPaid).toBe(6000);
      expect(result.refundDue).toBeCloseTo(1140.25, 2);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe("zero and empty inputs", () => {
    it("owes nothing when every input is zero", () => {
      const result = calculate();

      expect(result.grossIncome).toBe(0);
      expect(result.adjustedGrossIncome).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.nyTaxBenefitRecapture).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
      expect(result.safeHarbor!.minimum).toBe(0);
    });

    it("owes nothing as a New York City resident when every input is zero", () => {
      const result = calculate({ isNYCResident: true });

      expect(result.nycTax).toBe(0);
      expect(result.nycSchoolTaxCredit).toBe(0);
      expect(result.nycBracketBreakdown).toEqual([]);
      expect(result.totalTax).toBe(0);
    });

    it("owes nothing when income is below the standard deduction", () => {
      const result = calculate({ federalIncome: 5000, filingStatus: "single" });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("leaves the self-employment figures out when there is no self-employment income", () => {
      const result = calculate({ federalIncome: 100000 });

      expect(result.selfEmploymentIncome).toBeUndefined();
      expect(result.deductibleSETax).toBeUndefined();
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateNewYorkTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    const calculateForYear = (overrides: Partial<TaxInputs>) =>
      calculateNewYorkTax(
        createDefaultInputs({ taxYear: year, ...overrides }),
        data.newYorkBrackets,
        data.nycBrackets,
        data.newYorkDeductions,
        data.sharedLimits,
        data.newYorkLimits,
        data.ficaData,
      );

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it.each<FilingStatus>([
      "single",
      "marriedFilingJointly",
      "marriedFilingSeparately",
    ])("uses the year's standard deduction: %s", (filingStatus) => {
      const result = calculateForYear({ federalIncome: 100000, filingStatus });

      expect(result.deductionBreakdown.deductionAmount).toBe(
        data.newYorkDeductions.standardDeduction[filingStatus],
      );
    });

    it("uses the year's rate schedule", () => {
      // Single, $100,000 of wages, taxable income $92,000
      // 2025: $340 + $144 + $115.50 + $3,671.25 + $11,350 x 6% = $4,951.75
      // 2026: $331.50 + $140.80 + $113.30 + $3,604.50 + $11,350 x 5.9%
      //   = $4,859.75
      const expectedTax = {
        "2025": 4951.75,
        "2026": 4859.75,
      };

      const result = calculateForYear({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(expectedTax[year], 2);
    });

    it("uses the year's first-tier recapture rate", () => {
      // Married filing separately, $208,000 of wages: taxable income of
      // $200,000 with the first tier fully phased in, so the New York tax is
      // the year's flat rate on all taxable income (6% in 2025, 5.9% in 2026)
      const expectedTax = {
        "2025": 12000,
        "2026": 11800,
      };

      const result = calculateForYear({
        federalIncome: 208000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.totalTax).toBeCloseTo(
        200000 * data.newYorkLimits.taxBenefitRecapture.firstTierRate.single,
        2,
      );
      expect(result.totalTax).toBeCloseTo(expectedTax[year], 2);
    });

    it("uses the year's recapture tiers", () => {
      // Single, $300,000 of wages: taxable income $292,000, second tier
      // fully phased in
      // 2025: $568 + $1,831 = $2,399
      // 2026: $567 + $2,047 = $2,614
      const expectedRecapture = {
        "2025": 2399,
        "2026": 2614,
      };
      const tier = data.newYorkLimits.taxBenefitRecapture.tiers.single[0];

      const result = calculateForYear({
        federalIncome: 300000,
        filingStatus: "single",
      });

      expect(result.nyTaxBenefitRecapture).toBe(
        tier.recaptureBase + tier.incrementalBenefit,
      );
      expect(result.nyTaxBenefitRecapture).toBe(expectedRecapture[year]);
    });

    it("uses the year's New York City schedule and school tax credit", () => {
      // Single resident, $20,000 of wages: taxable income $12,000, all in
      // the first city bracket and at the rate reduction threshold
      const { fixedAmount, rateReduction } =
        data.newYorkLimits.nycSchoolTaxCredit;

      const result = calculateForYear({
        federalIncome: 20000,
        filingStatus: "single",
        isNYCResident: true,
      });

      expect(result.nycTax).toBeCloseTo(
        12000 * data.nycBrackets.brackets.single[0].rate,
        2,
      );
      expect(result.nycSchoolTaxCredit).toBeCloseTo(
        fixedAmount.default + 12000 * rateReduction.baseRate,
        2,
      );
    });

    it("uses the year's safe harbor percentages", () => {
      const { safeHarbor } = data.newYorkLimits;

      const overThreshold = calculateForYear({
        federalIncome: 100000,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: true,
      });
      const notOverThreshold = calculateForYear({
        federalIncome: 100000,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: false,
      });

      expect(overThreshold.safeHarbor!.currentYear90Percent).toBeCloseTo(
        overThreshold.totalTax * safeHarbor.currentYearPercent,
        2,
      );
      expect(overThreshold.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(
        10000 * safeHarbor.highIncomePriorYearPercent,
        2,
      );
      expect(notOverThreshold.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(
        10000 * safeHarbor.priorYearPercent,
        2,
      );
    });
  },
);

// These amounts were worked from the official 2025 IT-201 tax computation
// worksheets (see data/VERIFICATION.md), so they check the 2025 data and the
// worksheet method against published figures. The 2026 figures used in the
// rest of this file come from the estimated tax instructions.
describe("tax benefit recapture, 2025 worksheets", () => {
  const data = loadTestDataForYear("2025");

  // Recapture for a given NY AGI and taxable income, using the 2025 rate
  // schedule tax as the starting point
  const recaptureFor = (
    filingStatus: FilingStatus,
    agi: number,
    taxableIncome: number,
  ) => {
    const bracketTax = calculateTaxByBrackets(
      taxableIncome,
      data.newYorkBrackets.brackets[filingStatus],
    ).total;
    return {
      bracketTax,
      recapture: calculateTaxBenefitRecapture(
        bracketTax,
        taxableIncome,
        agi,
        filingStatus,
        data.newYorkLimits,
      ),
    };
  };

  it("adds nothing at or below $107,650 of NY AGI", () => {
    expect(recaptureFor("single", 107650, 99650).recapture).toBe(0);
    expect(recaptureFor("marriedFilingJointly", 100000, 83950).recapture).toBe(
      0,
    );
  });

  // [filing status, NY AGI, taxable income, recapture]
  it.each<[FilingStatus, number, number, number]>([
    // First tier, phasing toward 6% (single) or 5.5% (joint) of taxable income
    ["single", 110000, 102000, 26.71], // 568.25 x 0.0470
    ["single", 130000, 122000, 254.01], // 568.25 x 0.4470
    ["marriedFilingJointly", 108000, 91950, 2.33], // 332.50 x 0.0070
    ["marriedFilingJointly", 150000, 133950, 281.63], // 332.50 x 0.8470
    // Upper tiers: recapture base + incremental benefit x phase-in
    ["marriedFilingSeparately", 240000, 232000, 1468.85], // 568 + 1,831 x 0.4920
    ["single", 300000, 292000, 2399], // 568 + 1,831
    ["marriedFilingJointly", 400000, 380000, 3887], // 1,140 + 2,747
    ["single", 1100000, 1092000, 15946.23], // 2,399 + 30,172 x 0.4490
    ["marriedFilingJointly", 2180000, 2163950, 33639.55], // 3,887 + 60,350 x 0.4930
    ["single", 3000000, 2992000, 32571], // 2,399 + 30,172
    ["marriedFilingJointly", 5020000, 5003950, 77237], // 64,237 + 32,500 x 0.4
    ["single", 10000000, 9992000, 65071], // 32,571 + 32,500
    // Taxable income in a lower tier than AGI: the taxable income tier applies
    ["marriedFilingJointly", 400000, 300000, 1140], // 333 + 807
  ])("%s, AGI %i, taxable income %i", (status, agi, taxable, expected) => {
    expect(recaptureFor(status, agi, taxable).recapture).toBeCloseTo(
      expected,
      2,
    );
  });

  it("taxes all taxable income at the flat rate once the first tier is phased in", () => {
    // Single, AGI $200,000 with taxable income of $70,000: 6% x $70,000
    const { bracketTax, recapture } = recaptureFor("single", 200000, 70000);

    expect(bracketTax + recapture).toBeCloseTo(4200, 2);
  });

  it("taxes all taxable income at 10.9% above $25,000,000 of NY AGI", () => {
    const { bracketTax, recapture } = recaptureFor(
      "marriedFilingJointly",
      30000000,
      29983950,
    );

    expect(recapture).toBeCloseTo(246737.25, 1);
    expect(bracketTax + recapture).toBeCloseTo(3268250.55, 1);
  });
});
