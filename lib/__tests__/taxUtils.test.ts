import { describe, it, expect } from 'vitest';
import { calculateEffectiveRate, calculateEffectiveRates } from '../taxUtils';
import { TaxCalculationResult } from '../types';

describe('calculateEffectiveRate', () => {
  it('calculates rate correctly for normal values', () => {
    // $15,000 tax on $100,000 income = 15%
    expect(calculateEffectiveRate(15000, 100000)).toBeCloseTo(0.15, 4);
  });

  it('returns 0 when income is zero', () => {
    expect(calculateEffectiveRate(1000, 0)).toBe(0);
  });

  it('returns 0 when income is negative', () => {
    expect(calculateEffectiveRate(1000, -50000)).toBe(0);
  });

  it('handles zero tax correctly', () => {
    expect(calculateEffectiveRate(0, 100000)).toBe(0);
  });

  it('calculates small rates correctly', () => {
    // $1,000 tax on $100,000 income = 1%
    expect(calculateEffectiveRate(1000, 100000)).toBeCloseTo(0.01, 4);
  });

  it('calculates high rates correctly', () => {
    // $35,000 tax on $100,000 income = 35%
    expect(calculateEffectiveRate(35000, 100000)).toBeCloseTo(0.35, 4);
  });
});

describe('calculateEffectiveRates', () => {
  const createMockResult = (overrides: Partial<TaxCalculationResult>): TaxCalculationResult => ({
    wageIncome: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    grossIncome: 0,
    shortTermLossCarryoverOffset: 0,
    longTermLossCarryoverOffset: 0,
    contributions401k: 0,
    adjustedGrossIncome: 0,
    deductionBreakdown: {
      standardDeduction: 0,
      itemizedDeduction: 0,
      deductionUsed: 'standard',
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

  it('calculates both rates correctly', () => {
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

  it('includes LTCG in taxable income calculation', () => {
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

  it('returns zeros when all income is zero', () => {
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

  it('handles case where gross income is positive but taxable is zero', () => {
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

  it('rate on taxable is always >= rate on gross (when both positive)', () => {
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
