import { describe, it, expect, beforeAll } from "vitest";
import { calculateCaliforniaTax } from "../states/californiaTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import {
  californiaBrackets,
  californiaDeductions,
  sharedLimits,
  californiaLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

// Figures for the default tax year (2026), used as literals below.
//
// Standard deduction: $5,900 single and married filing separately,
// $11,800 married filing jointly.
//
// Single and married filing separately schedule, with the tax on a full
// bracket and the running total at the top of each bracket:
//   1%    $0        - $11,456    $114.56                       $114.56
//   2%    $11,456   - $27,157    $15,701 x 2%     = $314.02    $428.58
//   4%    $27,157   - $42,861    $15,704 x 4%     = $628.16    $1,056.74
//   6%    $42,861   - $59,498    $16,637 x 6%     = $998.22    $2,054.96
//   8%    $59,498   - $75,197    $15,699 x 8%     = $1,255.92  $3,310.88
//   9.3%  $75,197   - $384,109   $308,912 x 9.3%  = $28,728.82 $32,039.70
//   10.3% $384,109  - $460,927   $76,818 x 10.3%  = $7,912.25  $39,951.95
//   11.3% $460,927  - $768,213   $307,286 x 11.3% = $34,723.32 $74,675.27
//   12.3% $768,213 and over
//
// Married filing jointly schedule:
//   1%    $0          - $22,912     $229.12                       $229.12
//   2%    $22,912     - $54,314     $31,402 x 2%     = $628.04    $857.16
//   4%    $54,314     - $85,722     $31,408 x 4%     = $1,256.32  $2,113.48
//   6%    $85,722     - $118,996    $33,274 x 6%     = $1,996.44  $4,109.92
//   8%    $118,996    - $150,394    $31,398 x 8%     = $2,511.84  $6,621.76
//   9.3%  $150,394    - $768,218    $617,824 x 9.3%  = $57,457.63 $64,079.39
//   10.3% $768,218    - $921,854    $153,636 x 10.3% = $15,824.51 $79,903.90
//   11.3% $921,854    - $1,536,426  $614,572 x 11.3% = $69,446.64 $149,350.54
//   12.3% $1,536,426 and over

type InputOverrides = Parameters<typeof createDefaultInputs>[0];

const calculate = (overrides: InputOverrides = {}) =>
  calculateCaliforniaTax(
    createDefaultInputs(overrides),
    californiaBrackets,
    californiaDeductions,
    sharedLimits,
    californiaLimits,
    ficaData,
  );

describe("calculateCaliforniaTax", () => {
  describe("worked examples", () => {
    it("single, $100,000 of wages: $5,068.86", () => {
      // Taxable income: $100,000 - $5,900 standard deduction = $94,100
      //
      // $0 - $11,456 at 1%                           =   $114.56
      // $11,456 - $27,157 at 2%:  $15,701 x 2%       =   $314.02
      // $27,157 - $42,861 at 4%:  $15,704 x 4%       =   $628.16
      // $42,861 - $59,498 at 6%:  $16,637 x 6%       =   $998.22
      // $59,498 - $75,197 at 8%:  $15,699 x 8%       = $1,255.92
      // $75,197 - $94,100 at 9.3%: $18,903 x 9.3%    = $1,757.98
      // Total                                        = $5,068.86
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("standard");
      expect(result.deductionBreakdown.deductionAmount).toBe(5900);
      expect(result.taxableOrdinaryIncome).toBe(94100);
      expect(result.ordinaryIncomeTax).toBeCloseTo(5068.86, 2);
      expect(result.caMentalHealthTax).toBe(0);
      expect(result.totalTax).toBeCloseTo(5068.86, 2);
    });

    it("married filing jointly, $200,000 of wages: $10,137.72", () => {
      // Taxable income: $200,000 - $11,800 standard deduction = $188,200
      //
      // $0 - $22,912 at 1%                              =    $229.12
      // $22,912 - $54,314 at 2%:    $31,402 x 2%        =    $628.04
      // $54,314 - $85,722 at 4%:    $31,408 x 4%        =  $1,256.32
      // $85,722 - $118,996 at 6%:   $33,274 x 6%        =  $1,996.44
      // $118,996 - $150,394 at 8%:  $31,398 x 8%        =  $2,511.84
      // $150,394 - $188,200 at 9.3%: $37,806 x 9.3%     =  $3,515.96
      // Total                                           = $10,137.72
      const result = calculate({
        federalIncome: 200000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.deductionBreakdown.deductionAmount).toBe(11800);
      expect(result.taxableOrdinaryIncome).toBe(188200);
      expect(result.ordinaryIncomeTax).toBeCloseTo(10137.72, 2);
      expect(result.caMentalHealthTax).toBe(0);
      expect(result.totalTax).toBeCloseTo(10137.72, 2);
    });

    it("married filing separately, $400,000 of wages: $33,068.77", () => {
      // Taxable income: $400,000 - $5,900 standard deduction = $394,100
      // Married filing separately uses the single schedule.
      //
      // $0 - $11,456 at 1%                               =    $114.56
      // $11,456 - $27,157 at 2%:    $15,701 x 2%         =    $314.02
      // $27,157 - $42,861 at 4%:    $15,704 x 4%         =    $628.16
      // $42,861 - $59,498 at 6%:    $16,637 x 6%         =    $998.22
      // $59,498 - $75,197 at 8%:    $15,699 x 8%         =  $1,255.92
      // $75,197 - $384,109 at 9.3%: $308,912 x 9.3%      = $28,728.82
      // $384,109 - $394,100 at 10.3%: $9,991 x 10.3%     =  $1,029.07
      // Total                                            = $33,068.77
      const result = calculate({
        federalIncome: 400000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.deductionBreakdown.deductionAmount).toBe(5900);
      expect(result.taxableOrdinaryIncome).toBe(394100);
      expect(result.ordinaryIncomeTax).toBeCloseTo(33068.77, 2);
      expect(result.caMentalHealthTax).toBe(0);
      expect(result.totalTax).toBeCloseTo(33068.77, 2);
    });

    it("single, $1,200,000 of wages, with the mental health tax: $129,000.37", () => {
      // Taxable income: $1,200,000 - $5,900 standard deduction = $1,194,100
      //
      // $0 - $11,456 at 1%                                  =     $114.56
      // $11,456 - $27,157 at 2%:     $15,701 x 2%           =     $314.02
      // $27,157 - $42,861 at 4%:     $15,704 x 4%           =     $628.16
      // $42,861 - $59,498 at 6%:     $16,637 x 6%           =     $998.22
      // $59,498 - $75,197 at 8%:     $15,699 x 8%           =   $1,255.92
      // $75,197 - $384,109 at 9.3%:  $308,912 x 9.3%        =  $28,728.82
      // $384,109 - $460,927 at 10.3%: $76,818 x 10.3%       =   $7,912.25
      // $460,927 - $768,213 at 11.3%: $307,286 x 11.3%      =  $34,723.32
      // $768,213 - $1,194,100 at 12.3%: $425,887 x 12.3%    =  $52,384.10
      // Tax from the schedule                               = $127,059.37
      //
      // Mental health tax: ($1,194,100 - $1,000,000) x 1%   =   $1,941.00
      // Total                                               = $129,000.37
      const result = calculate({
        federalIncome: 1200000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(1194100);
      expect(result.ordinaryIncomeTax).toBeCloseTo(127059.37, 2);
      expect(result.caMentalHealthTax).toBeCloseTo(1941, 2);
      expect(result.totalTax).toBeCloseTo(129000.37, 2);
    });
  });

  describe("rate schedules", () => {
    // Wages are the taxable income plus the standard deduction, so each
    // taxable income is a round figure inside one bracket.
    it.each([
      // $10,000 x 1%
      { rate: "1%", taxableIncome: 10000, tax: 100 },
      // $114.56 + ($20,000 - $11,456 = $8,544) x 2% = $114.56 + $170.88
      { rate: "2%", taxableIncome: 20000, tax: 285.44 },
      // $428.58 + ($35,000 - $27,157 = $7,843) x 4% = $428.58 + $313.72
      { rate: "4%", taxableIncome: 35000, tax: 742.3 },
      // $1,056.74 + ($50,000 - $42,861 = $7,139) x 6% = $1,056.74 + $428.34
      { rate: "6%", taxableIncome: 50000, tax: 1485.08 },
      // $2,054.96 + ($70,000 - $59,498 = $10,502) x 8% = $2,054.96 + $840.16
      { rate: "8%", taxableIncome: 70000, tax: 2895.12 },
      // $3,310.88 + ($200,000 - $75,197 = $124,803) x 9.3%
      //   = $3,310.88 + $11,606.68
      { rate: "9.3%", taxableIncome: 200000, tax: 14917.56 },
      // $32,039.70 + ($400,000 - $384,109 = $15,891) x 10.3%
      //   = $32,039.70 + $1,636.77
      { rate: "10.3%", taxableIncome: 400000, tax: 33676.47 },
      // $39,951.95 + ($600,000 - $460,927 = $139,073) x 11.3%
      //   = $39,951.95 + $15,715.25
      { rate: "11.3%", taxableIncome: 600000, tax: 55667.2 },
      // $74,675.27 + ($900,000 - $768,213 = $131,787) x 12.3%
      //   = $74,675.27 + $16,209.80
      { rate: "12.3%", taxableIncome: 900000, tax: 90885.07 },
    ])(
      "single: $taxableIncome of taxable income reaches the $rate bracket",
      ({ taxableIncome, tax }) => {
        const result = calculate({
          federalIncome: taxableIncome + 5900,
          filingStatus: "single",
        });

        expect(result.taxableOrdinaryIncome).toBe(taxableIncome);
        expect(result.ordinaryIncomeTax).toBeCloseTo(tax, 2);
      },
    );

    it.each([
      // $20,000 x 1%
      { rate: "1%", taxableIncome: 20000, tax: 200 },
      // $229.12 + ($40,000 - $22,912 = $17,088) x 2% = $229.12 + $341.76
      { rate: "2%", taxableIncome: 40000, tax: 570.88 },
      // $857.16 + ($70,000 - $54,314 = $15,686) x 4% = $857.16 + $627.44
      { rate: "4%", taxableIncome: 70000, tax: 1484.6 },
      // $2,113.48 + ($100,000 - $85,722 = $14,278) x 6% = $2,113.48 + $856.68
      { rate: "6%", taxableIncome: 100000, tax: 2970.16 },
      // $4,109.92 + ($140,000 - $118,996 = $21,004) x 8%
      //   = $4,109.92 + $1,680.32
      { rate: "8%", taxableIncome: 140000, tax: 5790.24 },
      // $6,621.76 + ($400,000 - $150,394 = $249,606) x 9.3%
      //   = $6,621.76 + $23,213.36
      { rate: "9.3%", taxableIncome: 400000, tax: 29835.12 },
      // $64,079.39 + ($800,000 - $768,218 = $31,782) x 10.3%
      //   = $64,079.39 + $3,273.55
      { rate: "10.3%", taxableIncome: 800000, tax: 67352.94 },
      // $79,903.90 + ($1,200,000 - $921,854 = $278,146) x 11.3%
      //   = $79,903.90 + $31,430.50
      { rate: "11.3%", taxableIncome: 1200000, tax: 111334.4 },
      // $149,350.54 + ($1,800,000 - $1,536,426 = $263,574) x 12.3%
      //   = $149,350.54 + $32,419.60
      { rate: "12.3%", taxableIncome: 1800000, tax: 181770.14 },
    ])(
      "married filing jointly: $taxableIncome of taxable income reaches the $rate bracket",
      ({ taxableIncome, tax }) => {
        const result = calculate({
          federalIncome: taxableIncome + 11800,
          filingStatus: "marriedFilingJointly",
        });

        expect(result.taxableOrdinaryIncome).toBe(taxableIncome);
        expect(result.ordinaryIncomeTax).toBeCloseTo(tax, 2);
      },
    );

    it("married filing separately reaches the 12.3% bracket at $768,213, as single does", () => {
      // Taxable income: $905,900 - $5,900 = $900,000
      // $74,675.27 + ($900,000 - $768,213 = $131,787) x 12.3%
      //   = $74,675.27 + $16,209.80 = $90,885.07
      // (On the joint schedule the same income would still be at 10.3%.)
      const result = calculate({
        federalIncome: 905900,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.taxableOrdinaryIncome).toBe(900000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(90885.07, 2);
    });
  });

  describe("mental health tax", () => {
    it("applies the 1% mental health tax above $1,000,000 of taxable income", () => {
      // Taxable income: $1,105,900 - $5,900 = $1,100,000
      // ($1,100,000 - $1,000,000) x 1% = $1,000
      const result = calculate({
        federalIncome: 1105900,
        filingStatus: "single",
      });

      expect(result.caMentalHealthTax).toBeCloseTo(1000, 2);
    });

    it("adds the mental health tax to the tax from the schedule", () => {
      // Taxable income: $1,100,000
      // Schedule: $74,675.27 + ($1,100,000 - $768,213 = $331,787) x 12.3%
      //   = $74,675.27 + $40,809.80 = $115,485.07
      // Mental health tax: $1,000
      // Total: $116,485.07
      const result = calculate({
        federalIncome: 1105900,
        filingStatus: "single",
      });

      expect(result.ordinaryIncomeTax).toBeCloseTo(115485.07, 2);
      expect(result.totalTax).toBeCloseTo(116485.07, 2);
    });

    it("is zero at exactly $1,000,000 of taxable income, even though AGI is higher", () => {
      // AGI $1,005,900; taxable income $1,005,900 - $5,900 = $1,000,000
      const result = calculate({
        federalIncome: 1005900,
        filingStatus: "single",
      });

      expect(result.adjustedGrossIncome).toBe(1005900);
      expect(result.taxableOrdinaryIncome).toBe(1000000);
      expect(result.caMentalHealthTax).toBe(0);
    });

    it("is one cent at $1,000,001 of taxable income", () => {
      // ($1,000,001 - $1,000,000) x 1% = $0.01
      const result = calculate({
        federalIncome: 1005901,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(1000001);
      expect(result.caMentalHealthTax).toBeCloseTo(0.01, 4);
    });

    it("uses the same $1,000,000 threshold for married filing jointly", () => {
      // Taxable income: $1,111,800 - $11,800 = $1,100,000
      // ($1,100,000 - $1,000,000) x 1% = $1,000
      const result = calculate({
        federalIncome: 1111800,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.taxableOrdinaryIncome).toBe(1100000);
      expect(result.caMentalHealthTax).toBeCloseTo(1000, 2);
    });

    it("uses the same $1,000,000 threshold for married filing separately", () => {
      // The threshold is not halved: $605,900 - $5,900 = $600,000 of taxable
      // income owes none, and $1,105,900 - $5,900 = $1,100,000 owes
      // ($1,100,000 - $1,000,000) x 1% = $1,000
      const below = calculate({
        federalIncome: 605900,
        filingStatus: "marriedFilingSeparately",
      });
      const above = calculate({
        federalIncome: 1105900,
        filingStatus: "marriedFilingSeparately",
      });

      expect(below.taxableOrdinaryIncome).toBe(600000);
      expect(below.caMentalHealthTax).toBe(0);
      expect(above.caMentalHealthTax).toBeCloseTo(1000, 2);
    });

    it("counts every type of income toward the $1,000,000", () => {
      // $400,000 wages + $300,000 long-term gains + $200,000 short-term gains
      // + $100,000 interest + $105,900 dividends = $1,105,900
      // Taxable income: $1,105,900 - $5,900 = $1,100,000
      // ($1,100,000 - $1,000,000) x 1% = $1,000
      const result = calculate({
        federalIncome: 400000,
        longTermCapitalGains: 300000,
        shortTermCapitalGains: 200000,
        interestIncome: 100000,
        ordinaryDividends: 105900,
        qualifiedDividends: 105900,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(1100000);
      expect(result.caMentalHealthTax).toBeCloseTo(1000, 2);
    });
  });

  describe("all income is taxed at ordinary rates", () => {
    // Each return has $100,000 of income and so $94,100 of taxable income,
    // which owes $5,068.86 (the first worked example), whatever the mix.

    it("taxes long-term and short-term capital gains on the ordinary schedule", () => {
      // $50,000 wages + $30,000 long-term gains + $20,000 short-term gains
      const result = calculate({
        federalIncome: 50000,
        longTermCapitalGains: 30000,
        shortTermCapitalGains: 20000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(100000);
      expect(result.taxableOrdinaryIncome).toBe(94100);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ltcgTax).toBe(0);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.totalTax).toBeCloseTo(5068.86, 2);
    });

    it("taxes interest and dividends, including qualified dividends, on the ordinary schedule", () => {
      // $50,000 wages + $20,000 interest + $30,000 dividends, all qualified
      const result = calculate({
        federalIncome: 50000,
        interestIncome: 20000,
        ordinaryDividends: 30000,
        qualifiedDividends: 30000,
        filingStatus: "single",
      });

      expect(result.grossIncome).toBe(100000);
      expect(result.interestIncome).toBe(20000);
      expect(result.ordinaryDividends).toBe(30000);
      expect(result.taxableOrdinaryIncome).toBe(94100);
      expect(result.totalTax).toBeCloseTo(5068.86, 2);
    });
  });

  describe("U.S. Treasury interest", () => {
    it("is excluded from California income", () => {
      // $100,000 wages + $20,000 interest, of which $12,000 is from Treasuries
      // Taxable interest: $20,000 - $12,000 = $8,000
      // Gross income: $100,000 + $8,000 = $108,000
      // Taxable income: $108,000 - $5,900 = $102,100
      const result = calculate({
        federalIncome: 100000,
        interestIncome: 20000,
        treasuryInterest: 12000,
        filingStatus: "single",
      });

      expect(result.interestIncome).toBe(8000);
      expect(result.grossIncome).toBe(108000);
      expect(result.taxableOrdinaryIncome).toBe(102100);
    });
  });

  describe("prior-year state balance", () => {
    it("is not a payment toward this year's California tax", () => {
      // Tax on $200,000 of wages (taxable income $194,100):
      //   $3,310.88 + ($194,100 - $75,197 = $118,903) x 9.3%
      //   = $3,310.88 + $11,057.98 = $14,368.86
      // Paid this year: $10,000 withheld. The $6,000 paid with last year's
      // return does not count.
      // Owed: $14,368.86 - $10,000 = $4,368.86
      const result = calculate({
        federalIncome: 200000,
        stateTaxWithheld: 10000,
        priorYearStateBalancePaid: 6000,
        filingStatus: "single",
      });

      expect(result.totalPaid).toBe(10000);
      expect(result.remainingOwed).toBeCloseTo(4368.86, 2);
    });
  });

  describe("safe harbor", () => {
    // Unless noted, each return is single with $205,900 of wages: taxable
    // income $200,000 and tax $14,917.56 (see "rate schedules"), so 90% of
    // this year's tax is $13,425.80.

    it("requires 90% of this year's tax when no prior-year tax is entered", () => {
      // $14,917.56 x 90% = $13,425.80
      const result = calculate({
        federalIncome: 205900,
        filingStatus: "single",
      });

      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(13425.8, 2);
      expect(result.safeHarbor!.minimum).toBeCloseTo(13425.8, 2);
    });

    it("accepts 110% of last year's tax when last year's income was over $150,000", () => {
      // $10,000 x 110% = $11,000, less than $13,425.80
      const result = calculate({
        federalIncome: 205900,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: true,
        filingStatus: "single",
      });

      expect(result.safeHarbor!.priorYearPercent).toBe(1.1);
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(11000, 2);
      expect(result.safeHarbor!.minimum).toBeCloseTo(11000, 2);
    });

    it("accepts 100% of last year's tax when last year's income was not over $150,000", () => {
      // $10,000 x 100% = $10,000, less than $13,425.80
      const result = calculate({
        federalIncome: 205900,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: false,
        filingStatus: "single",
      });

      expect(result.safeHarbor!.priorYearPercent).toBe(1);
      expect(result.safeHarbor!.minimum).toBe(10000);
    });

    it("drops the prior-year method at exactly $1,000,000 of AGI", () => {
      // AGI $1,000,000; taxable income $994,100, below the mental health tax
      // Tax: $74,675.27 + ($994,100 - $768,213 = $225,887) x 12.3%
      //   = $74,675.27 + $27,784.10 = $102,459.37
      // Required: $102,459.37 x 90% = $92,213.43, although 110% of last
      // year's $20,000 would be only $22,000
      const result = calculate({
        federalIncome: 1000000,
        priorYearStateTax: 20000,
        filingStatus: "single",
      });

      expect(result.adjustedGrossIncome).toBe(1000000);
      expect(result.safeHarbor!.highIncomeException).toBe(true);
      expect(result.safeHarbor!.minimum).toBeCloseTo(92213.43, 2);
    });

    it("keeps the prior-year method at $999,999 of AGI", () => {
      // $20,000 x 110% = $22,000
      const result = calculate({
        federalIncome: 999999,
        priorYearStateTax: 20000,
        filingStatus: "single",
      });

      expect(result.safeHarbor!.highIncomeException).toBe(false);
      expect(result.safeHarbor!.minimum).toBeCloseTo(22000, 2);
    });

    it("measures the $1,000,000 on AGI, after 401(k) contributions", () => {
      // $1,010,000 wages - $10,001 of 401(k) = $999,999 of AGI
      // $20,000 x 110% = $22,000
      const result = calculate({
        federalIncome: 1010000,
        contributions401k: 10001,
        priorYearStateTax: 20000,
        filingStatus: "single",
      });

      expect(result.adjustedGrossIncome).toBe(999999);
      expect(result.safeHarbor!.highIncomeException).toBe(false);
      expect(result.safeHarbor!.minimum).toBeCloseTo(22000, 2);
    });

    it("drops the prior-year method at exactly $500,000 of AGI when married filing separately", () => {
      // Taxable income: $500,000 - $5,900 = $494,100
      // Tax: $39,951.95 + ($494,100 - $460,927 = $33,173) x 11.3%
      //   = $39,951.95 + $3,748.55 = $43,700.50
      // Required: $43,700.50 x 90% = $39,330.45
      const result = calculate({
        federalIncome: 500000,
        priorYearStateTax: 20000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.safeHarbor!.highIncomeException).toBe(true);
      expect(result.safeHarbor!.minimum).toBeCloseTo(39330.45, 2);
    });

    it("keeps the prior-year method at $499,999 of AGI when married filing separately", () => {
      // $20,000 x 110% = $22,000
      const result = calculate({
        federalIncome: 499999,
        priorYearStateTax: 20000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.safeHarbor!.highIncomeException).toBe(false);
      expect(result.safeHarbor!.minimum).toBeCloseTo(22000, 2);
    });

    it("keeps the prior-year method for a single filer at $500,000 of AGI", () => {
      // The $500,000 cutoff is only for married filing separately
      // $20,000 x 110% = $22,000
      const result = calculate({
        federalIncome: 500000,
        priorYearStateTax: 20000,
        filingStatus: "single",
      });

      expect(result.safeHarbor!.highIncomeException).toBe(false);
      expect(result.safeHarbor!.minimum).toBeCloseTo(22000, 2);
    });

    it("drops the prior-year method at exactly $1,000,000 of AGI when married filing jointly", () => {
      // The cutoff is not doubled for a joint return.
      // Taxable income: $1,000,000 - $11,800 = $988,200
      // Tax: $79,903.90 + ($988,200 - $921,854 = $66,346) x 11.3%
      //   = $79,903.90 + $7,497.10 = $87,401.00
      // Required: $87,401.00 x 90% = $78,660.90
      const result = calculate({
        federalIncome: 1000000,
        priorYearStateTax: 20000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.safeHarbor!.highIncomeException).toBe(true);
      expect(result.safeHarbor!.minimum).toBeCloseTo(78660.9, 2);
    });

    it("keeps the prior-year method at $999,999 of AGI when married filing jointly", () => {
      // $20,000 x 110% = $22,000
      const result = calculate({
        federalIncome: 999999,
        priorYearStateTax: 20000,
        filingStatus: "marriedFilingJointly",
      });

      expect(result.safeHarbor!.highIncomeException).toBe(false);
      expect(result.safeHarbor!.minimum).toBeCloseTo(22000, 2);
    });
  });

  describe("shared building blocks", () => {
    it("taxes California income when it differs from federal income", () => {
      // Taxable income: $120,000 - $5,900 = $114,100
      const result = calculate({
        federalIncome: 150000,
        stateIncome: 120000,
        filingStatus: "single",
      });

      expect(result.wageIncome).toBe(120000);
      expect(result.grossIncome).toBe(120000);
      expect(result.taxableOrdinaryIncome).toBe(114100);
    });

    it("subtracts 401(k) contributions and pre-tax medical to reach AGI", () => {
      // AGI: $120,000 - $20,000 - $5,000 = $95,000
      // Taxable income: $95,000 - $5,900 = $89,100
      const result = calculate({
        federalIncome: 120000,
        contributions401k: 20000,
        preTaxMedical: 5000,
        filingStatus: "single",
      });

      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.adjustedGrossIncome).toBe(95000);
      expect(result.taxableOrdinaryIncome).toBe(89100);
    });

    it("taxes self-employment income and deducts half of the self-employment tax", () => {
      // Gross income: $100,000 wages + $50,000 self-employment = $150,000
      // Net earnings: $50,000 x 92.35% = $46,175
      // Social Security: $46,175 x 12.4% = $5,725.70 (wages plus net earnings
      //   are under the wage base)
      // Medicare: $46,175 x 2.9% = $1,339.08
      // Deductible half: ($5,725.70 + $1,339.08) x 50% = $3,532.39
      // AGI: $150,000 - $3,532.39 = $146,467.61
      // Taxable income: $146,467.61 - $5,900 = $140,567.61
      const result = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      expect(result.selfEmploymentIncome).toBe(50000);
      expect(result.grossIncome).toBe(150000);
      expect(result.deductibleSETax).toBeCloseTo(3532.39, 2);
      expect(result.adjustedGrossIncome).toBeCloseTo(146467.61, 2);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(140567.61, 2);
    });

    it("deducts a capital loss carryover up to the limit for the filing status", () => {
      // Married filing separately: $1,500 of the $5,000 short-term carryover
      // is deductible this year and $3,500 carries forward
      // AGI: $100,000 - $1,500 = $98,500
      // Taxable income: $98,500 - $5,900 = $92,600
      const result = calculate({
        federalIncome: 100000,
        priorYearShortTermLossCarryover: 5000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(result.shortTermLossCarryoverOffset).toBe(1500);
      expect(result.shortTermLossCarryoverUnused).toBe(3500);
      expect(result.longTermLossCarryoverOffset).toBe(0);
      expect(result.adjustedGrossIncome).toBe(98500);
      expect(result.taxableOrdinaryIncome).toBe(92600);
    });

    it("uses California's itemized deductions, limited by California AGI", () => {
      // AGI: $620,000 - $20,000 of 401(k) = $600,000
      // Itemized: $15,000 property tax + $30,000 mortgage interest (balance
      //   under $1,000,000) + $20,000 charitable = $65,000; the $40,000 of
      //   state income tax withheld is not deductible
      // High-income limit: 6% x ($600,000 - $252,203 = $347,797) = $20,867.82
      //   (less than 80% x $65,000 = $52,000)
      // Deduction: $65,000 - $20,867.82 = $44,132.18
      // Taxable income: $600,000 - $44,132.18 = $555,867.82
      const result = calculate({
        federalIncome: 620000,
        contributions401k: 20000,
        propertyTaxesPaid: 15000,
        mortgageInterestPaid: 30000,
        mortgageBalance: 900000,
        charitableContributions: 20000,
        stateTaxWithheld: 40000,
        filingStatus: "single",
      });

      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.propertyTax).toBe(15000);
      expect(result.deductionBreakdown.highIncomeReduction).toBeCloseTo(
        20867.82,
        2,
      );
      expect(result.deductionBreakdown.deductionAmount).toBeCloseTo(
        44132.18,
        2,
      );
      expect(result.taxableOrdinaryIncome).toBeCloseTo(555867.82, 2);
    });

    it("counts withholding and estimated payments, and reports a refund when they exceed the tax", () => {
      // Tax on $100,000 of wages: $5,068.86 (the first worked example)
      // Paid: $4,000 withheld + $2,000 estimated = $6,000
      // Refund: $6,000 - $5,068.86 = $931.14
      const result = calculate({
        federalIncome: 100000,
        stateTaxWithheld: 4000,
        stateEstimatedPaid: 2000,
        filingStatus: "single",
      });

      expect(result.withheld).toBe(4000);
      expect(result.estimatedPaid).toBe(2000);
      expect(result.totalPaid).toBe(6000);
      expect(result.refundDue).toBeCloseTo(931.14, 2);
      expect(result.remainingOwed).toBe(0);
    });

    it("measures California payments against the safe harbor amount", () => {
      // $205,900 of wages: tax $14,917.56, 90% is $13,425.80
      // Last year's tax $10,000 x 110% = $11,000, the lower of the two
      // Paid: $9,000 withheld + $1,500 estimated = $10,500
      // Short by $11,000 - $10,500 = $500
      const result = calculate({
        federalIncome: 205900,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: true,
        stateTaxWithheld: 9000,
        stateEstimatedPaid: 1500,
        filingStatus: "single",
      });

      expect(result.safeHarbor!.minimum).toBeCloseTo(11000, 2);
      expect(result.safeHarbor!.met).toBe(false);
      expect(result.safeHarbor!.remaining).toBeCloseTo(500, 2);
    });
  });

  describe("zero and empty inputs", () => {
    it("returns zero tax when every input is zero", () => {
      const result = calculate();

      expect(result.grossIncome).toBe(0);
      expect(result.adjustedGrossIncome).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.caMentalHealthTax).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
      expect(result.safeHarbor!.minimum).toBe(0);
      expect(result.safeHarbor!.met).toBe(true);
    });

    it("leaves the self-employment figures out when there is no self-employment income", () => {
      const result = calculate({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.selfEmploymentIncome).toBeUndefined();
      expect(result.deductibleSETax).toBeUndefined();
    });

    it("does not let taxable income fall below zero when income is under the standard deduction", () => {
      // $5,000 of wages - $5,900 standard deduction is negative, so $0
      const result = calculate({
        federalIncome: 5000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateCaliforniaTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    const calculateForYear = (overrides: InputOverrides) =>
      calculateCaliforniaTax(
        createDefaultInputs({ taxYear: year, ...overrides }),
        data.californiaBrackets,
        data.californiaDeductions,
        data.sharedLimits,
        data.californiaLimits,
        data.ficaData,
      );

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("taxes $100,000 of wages for a single filer using that year's schedule and standard deduction", () => {
      // 2025: taxable income $100,000 - $5,706 = $94,294
      //   $11,079 x 1%                               =   $110.79
      //   ($26,264 - $11,079 = $15,185) x 2%         =   $303.70
      //   ($41,452 - $26,264 = $15,188) x 4%         =   $607.52
      //   ($57,542 - $41,452 = $16,090) x 6%         =   $965.40
      //   ($72,724 - $57,542 = $15,182) x 8%         = $1,214.56
      //   ($94,294 - $72,724 = $21,570) x 9.3%       = $2,006.01
      //   Total                                      = $5,207.98
      // 2026: taxable income $94,100, tax $5,068.86 (the first worked example)
      const expected = {
        "2025": { taxableIncome: 94294, tax: 5207.98 },
        "2026": { taxableIncome: 94100, tax: 5068.86 },
      }[year];

      const result = calculateForYear({
        federalIncome: 100000,
        filingStatus: "single",
      });

      expect(result.taxableOrdinaryIncome).toBe(expected.taxableIncome);
      expect(result.totalTax).toBeCloseTo(expected.tax, 2);
    });

    it.each([
      "single",
      "marriedFilingJointly",
      "marriedFilingSeparately",
    ] as const)(
      "uses that year's standard deduction and first bracket for %s",
      (filingStatus) => {
        // Wages of the standard deduction plus the whole first bracket are
        // taxed at the first bracket's rate, and no more.
        const standardDeduction =
          data.californiaDeductions.standardDeduction[filingStatus];
        const firstBracket = data.californiaBrackets.brackets[filingStatus][0];

        const result = calculateForYear({
          federalIncome: standardDeduction + firstBracket.max!,
          filingStatus,
        });

        expect(result.deductionBreakdown.deductionAmount).toBe(
          standardDeduction,
        );
        expect(result.taxableOrdinaryIncome).toBe(firstBracket.max);
        expect(result.totalTax).toBeCloseTo(
          firstBracket.max! * firstBracket.rate,
          2,
        );
      },
    );

    it("uses that year's mental health tax threshold and rate", () => {
      // $100,000 of taxable income over the threshold
      const { rate, threshold } = data.californiaLimits.mentalHealthTax;
      const standardDeduction =
        data.californiaDeductions.standardDeduction.single;

      const result = calculateForYear({
        federalIncome: threshold + 100000 + standardDeduction,
        filingStatus: "single",
      });

      expect(result.caMentalHealthTax).toBeCloseTo(100000 * rate, 2);
    });

    it("uses that year's safe harbor percentages and AGI cutoff", () => {
      const {
        currentYearPercent,
        highIncomePriorYearPercent,
        priorYearUnavailableAgi,
      } = data.californiaLimits.safeHarbor;

      const underCutoff = calculateForYear({
        federalIncome: priorYearUnavailableAgi.default - 1,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: true,
        filingStatus: "single",
      });
      const atCutoff = calculateForYear({
        federalIncome: priorYearUnavailableAgi.default,
        priorYearStateTax: 10000,
        priorYearIncomeOverThreshold: true,
        filingStatus: "single",
      });

      expect(underCutoff.safeHarbor!.minimum).toBeCloseTo(
        10000 * highIncomePriorYearPercent,
        2,
      );
      expect(atCutoff.safeHarbor!.minimum).toBeCloseTo(
        atCutoff.totalTax * currentYearPercent,
        2,
      );
    });
  },
);
