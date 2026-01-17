import { describe, it, expect } from "vitest";
import {
  calculateEffectiveRate,
  calculateEffectiveRates,
  calculateLTCGTaxWithStacking,
} from "../taxUtils";
import { TaxCalculationResult, TaxBracket } from "../types";

describe("calculateEffectiveRate", () => {
  it("calculates rate correctly for normal values", () => {
    // $15,000 tax on $100,000 income = 15%
    expect(calculateEffectiveRate(15000, 100000)).toBeCloseTo(0.15, 4);
  });

  it("returns 0 when income is zero", () => {
    expect(calculateEffectiveRate(1000, 0)).toBe(0);
  });

  it("returns 0 when income is negative", () => {
    expect(calculateEffectiveRate(1000, -50000)).toBe(0);
  });

  it("handles zero tax correctly", () => {
    expect(calculateEffectiveRate(0, 100000)).toBe(0);
  });

  it("calculates small rates correctly", () => {
    // $1,000 tax on $100,000 income = 1%
    expect(calculateEffectiveRate(1000, 100000)).toBeCloseTo(0.01, 4);
  });

  it("calculates high rates correctly", () => {
    // $35,000 tax on $100,000 income = 35%
    expect(calculateEffectiveRate(35000, 100000)).toBeCloseTo(0.35, 4);
  });
});

describe("calculateEffectiveRates", () => {
  const createMockResult = (
    overrides: Partial<TaxCalculationResult>,
  ): TaxCalculationResult => ({
    wageIncome: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    grossIncome: 0,
    shortTermLossCarryoverOffset: 0,
    longTermLossCarryoverOffset: 0,
    contributions401k: 0,
    preTaxMedical: 0,
    adjustedGrossIncome: 0,
    deductionBreakdown: {
      standardDeduction: 0,
      itemizedDeduction: 0,
      deductionUsed: "standard",
      deductionAmount: 0,
      saltDeduction: 0,
      saltCapped: false,
      mortgageInterest: 0,
      charitableContributions: 0,
    },
    taxableOrdinaryIncome: 0,
    taxableLTCG: 0,
    ordinaryIncomeBracketBreakdown: [],
    ltcgBracketBreakdown: [],
    ordinaryIncomeTax: 0,
    ltcgTax: 0,
    totalTax: 0,
    withheld: 0,
    estimatedPaid: 0,
    totalPaid: 0,
    remainingOwed: 0,
    refundDue: 0,
    ...overrides,
  });

  it("calculates both rates correctly", () => {
    const result = createMockResult({
      grossIncome: 150000,
      taxableOrdinaryIncome: 120000,
      taxableLTCG: 0,
      totalTax: 18000,
    });

    const rates = calculateEffectiveRates(result);

    // $18k / $120k taxable = 15%
    expect(rates.onTaxableIncome).toBeCloseTo(0.15, 4);
    // $18k / $150k gross = 12%
    expect(rates.onGrossIncome).toBeCloseTo(0.12, 4);
  });

  it("includes LTCG in taxable income calculation", () => {
    const result = createMockResult({
      grossIncome: 200000,
      taxableOrdinaryIncome: 100000,
      taxableLTCG: 50000,
      totalTax: 22500,
    });

    const rates = calculateEffectiveRates(result);

    // $22.5k / ($100k + $50k) = 15%
    expect(rates.onTaxableIncome).toBeCloseTo(0.15, 4);
    // $22.5k / $200k = 11.25%
    expect(rates.onGrossIncome).toBeCloseTo(0.1125, 4);
  });

  it("returns zeros when all income is zero", () => {
    const result = createMockResult({
      grossIncome: 0,
      taxableOrdinaryIncome: 0,
      taxableLTCG: 0,
      totalTax: 0,
    });

    const rates = calculateEffectiveRates(result);

    expect(rates.onTaxableIncome).toBe(0);
    expect(rates.onGrossIncome).toBe(0);
  });

  it("handles case where gross income is positive but taxable is zero", () => {
    // This can happen when deductions exceed income
    const result = createMockResult({
      grossIncome: 15000,
      taxableOrdinaryIncome: 0,
      taxableLTCG: 0,
      totalTax: 0,
    });

    const rates = calculateEffectiveRates(result);

    expect(rates.onTaxableIncome).toBe(0);
    expect(rates.onGrossIncome).toBe(0);
  });

  it("rate on taxable is always >= rate on gross (when both positive)", () => {
    // Since taxable <= gross, rate on taxable should be >= rate on gross
    const result = createMockResult({
      grossIncome: 200000,
      taxableOrdinaryIncome: 150000,
      taxableLTCG: 0,
      totalTax: 30000,
    });

    const rates = calculateEffectiveRates(result);

    expect(rates.onTaxableIncome).toBeGreaterThanOrEqual(rates.onGrossIncome);
  });
});

describe("calculateLTCGTaxWithStacking", () => {
  // 2025 Single brackets: 0% up to $47,025, 15% up to $518,900, 20% above
  const singleBrackets: TaxBracket[] = [
    { min: 0, max: 47025, rate: 0.0 },
    { min: 47025, max: 518900, rate: 0.15 },
    { min: 518900, max: null, rate: 0.2 },
  ];

  it("returns zero for zero LTCG", () => {
    const result = calculateLTCGTaxWithStacking(0, 50000, singleBrackets);
    expect(result.total).toBe(0);
    expect(result.breakdown).toHaveLength(0);
    expect(result.ltcgInZeroBracket).toBe(0);
  });

  it("returns zero for negative LTCG", () => {
    const result = calculateLTCGTaxWithStacking(-5000, 50000, singleBrackets);
    expect(result.total).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  it("all LTCG in 0% bracket when no ordinary income", () => {
    // $20k LTCG with $0 ordinary income -> all in 0% bracket
    const result = calculateLTCGTaxWithStacking(20000, 0, singleBrackets);
    expect(result.total).toBe(0);
    expect(result.ltcgInZeroBracket).toBe(20000);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(0);
    expect(result.breakdown[0].incomeInBracket).toBe(20000);
  });

  it("LTCG stacks on top of ordinary income", () => {
    // $40k ordinary + $20k LTCG = $60k total
    // 0% bracket threshold = $47,025
    // Room in 0% bracket = $47,025 - $40,000 = $7,025
    // $7,025 LTCG at 0%, $12,975 LTCG at 15%
    const result = calculateLTCGTaxWithStacking(20000, 40000, singleBrackets);

    expect(result.ltcgInZeroBracket).toBe(7025);
    expect(result.breakdown).toHaveLength(2);

    // First bracket: 0%
    expect(result.breakdown[0].rate).toBe(0);
    expect(result.breakdown[0].incomeInBracket).toBe(7025);
    expect(result.breakdown[0].taxForBracket).toBe(0);

    // Second bracket: 15%
    expect(result.breakdown[1].rate).toBe(0.15);
    expect(result.breakdown[1].incomeInBracket).toBe(12975);
    expect(result.breakdown[1].taxForBracket).toBeCloseTo(12975 * 0.15, 2);

    expect(result.total).toBeCloseTo(12975 * 0.15, 2);
  });

  it("all LTCG at 15% when ordinary income fills 0% bracket", () => {
    // $50k ordinary income (above $47,025 threshold)
    // All $20k LTCG should be at 15%
    const result = calculateLTCGTaxWithStacking(20000, 50000, singleBrackets);

    expect(result.ltcgInZeroBracket).toBe(0);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(0.15);
    expect(result.breakdown[0].incomeInBracket).toBe(20000);
    expect(result.total).toBeCloseTo(20000 * 0.15, 2);
  });

  it("LTCG exactly fills remaining 0% bracket", () => {
    // $40k ordinary, exactly $7,025 LTCG
    // All LTCG should be at 0%
    const result = calculateLTCGTaxWithStacking(7025, 40000, singleBrackets);

    expect(result.ltcgInZeroBracket).toBe(7025);
    expect(result.total).toBe(0);
    expect(result.breakdown).toHaveLength(1);
  });

  it("LTCG spans 15% and 20% brackets for high income", () => {
    // $500k ordinary + $50k LTCG
    // 15% bracket ends at $518,900
    // Room in 15% bracket = $518,900 - $500,000 = $18,900
    // $18,900 at 15%, $31,100 at 20%
    const result = calculateLTCGTaxWithStacking(50000, 500000, singleBrackets);

    expect(result.ltcgInZeroBracket).toBe(0);
    expect(result.breakdown).toHaveLength(2);

    // 15% portion
    expect(result.breakdown[0].rate).toBe(0.15);
    expect(result.breakdown[0].incomeInBracket).toBe(18900);

    // 20% portion
    expect(result.breakdown[1].rate).toBe(0.2);
    expect(result.breakdown[1].incomeInBracket).toBe(31100);

    const expectedTax = 18900 * 0.15 + 31100 * 0.2;
    expect(result.total).toBeCloseTo(expectedTax, 2);
  });

  it("all LTCG at 20% when ordinary income exceeds 15% bracket", () => {
    // $600k ordinary (above $518,900) + $50k LTCG
    // All LTCG at 20%
    const result = calculateLTCGTaxWithStacking(50000, 600000, singleBrackets);

    expect(result.ltcgInZeroBracket).toBe(0);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(0.2);
    expect(result.breakdown[0].incomeInBracket).toBe(50000);
    expect(result.total).toBeCloseTo(50000 * 0.2, 2);
  });
});
