import { describe, it, expect } from 'vitest';
import { calculateCaliforniaTax } from '../californiaTaxCalculator';
import { TaxInputs, TaxBracketsData, DeductionsData, LimitsData } from '../types';

// Load data from JSON files
import californiaBrackets from '../../data/california-brackets-2025.json';
import californiaDeductions from '../../data/california-deductions-2025.json';
import limits from '../../data/limits-2025.json';

function createDefaultInputs(overrides: Partial<TaxInputs> = {}): TaxInputs {
  return {
    federalIncome: 0,
    californiaIncome: 0,
    shortTermCapitalGains: 0,
    longTermCapitalGains: 0,
    federalTaxWithheld: 0,
    californiaTaxWithheld: 0,
    federalEstimatedPaid: 0,
    californiaEstimatedPaid: 0,
    filingStatus: 'single',
    propertyTaxesPaid: 0,
    mortgageInterestPaid: 0,
    mortgageBalance: 0,
    charitableContributions: 0,
    contributions401k: 0,
    priorYearFederalTaxPaid: 0,
    priorYearCaliforniaTaxPaid: 0,
    priorYearShortTermLossCarryover: 0,
    priorYearLongTermLossCarryover: 0,
    ...overrides,
  };
}

describe('calculateCaliforniaTax', () => {
  describe('capital gains as ordinary income', () => {
    it('taxes both short-term and long-term capital gains at ordinary rates', () => {
      // Single filer with $50,000 LTCG and $50,000 STCG
      // Gross = $0 + $50,000 + $50,000 = $100,000
      // All taxed as ordinary income (no preferential LTCG rates)
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 50000,
        shortTermCapitalGains: 50000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // Verify all gains are included in ordinary income
      expect(result.grossIncome).toBe(100000);
      expect(result.taxableLTCG).toBe(0); // CA doesn't separate LTCG
      // Tax should be > 0 and calculated on the full amount
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
    });
  });

  describe('mental health tax', () => {
    it('applies 1% mental health tax on income above $1M', () => {
      // Single filer with $1,100,000 income
      // Mental health tax = (taxable income - $1,000,000) * 1%
      const inputs = createDefaultInputs({
        federalIncome: 1100000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // The mental health tax is stored in ltcgTax field (repurposed)
      // Calculate expected: income - std deduction = $1,094,460
      // Mental health tax = ($1,094,460 - $1,000,000) * 0.01 = $944.60
      expect(result.ltcgTax).toBeCloseTo(944.60, 2);
    });

    it('does not apply mental health tax at exactly $1M', () => {
      // Taxable income needs to be exactly $1M or less
      // $1,005,540 - $5,540 std deduction = $1,000,000 taxable
      const inputs = createDefaultInputs({
        federalIncome: 1005540,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.ltcgTax).toBe(0);
    });
  });

  describe('safe harbor with high income exception', () => {
    it('only uses 90% current year method for high income taxpayers (AGI > $1M)', () => {
      // Single filer with $1,500,000 income
      // AGI > $1M, so high income exception applies
      // Cannot use 100% prior year method
      const inputs = createDefaultInputs({
        federalIncome: 1500000,
        priorYearCaliforniaTaxPaid: 50000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.highIncomeException).toBe(true);
      // Minimum should equal 90% of current year (not the lesser of 90%/100%)
      expect(result.safeHarbor!.minimum).toBeCloseTo(result.totalTax * 0.9, 2);
    });

    it('can use 100% prior year method when AGI is under threshold', () => {
      // Single filer with $500,000 income (under $1M threshold)
      const inputs = createDefaultInputs({
        federalIncome: 500000,
        priorYearCaliforniaTaxPaid: 100000, // High prior year to make 100% method more favorable
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.highIncomeException).toBe(false);
      // Should be able to use 100% prior year if it's lower
      expect(result.safeHarbor!.minimum).toBeLessThanOrEqual(result.totalTax * 0.9);
    });

    it('uses $500k threshold for MFS high income exception', () => {
      // MFS threshold is $500k vs $1M for single/MFJ
      const inputs = createDefaultInputs({
        federalIncome: 600000,
        priorYearCaliforniaTaxPaid: 20000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.safeHarbor!.highIncomeException).toBe(true);
    });

    it('MFJ uses $1M threshold for high income exception', () => {
      // $900k AGI is under $1M threshold for MFJ
      const inputs = createDefaultInputs({
        federalIncome: 900000,
        priorYearCaliforniaTaxPaid: 30000,
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.safeHarbor!.highIncomeException).toBe(false);
    });
  });

  describe('loss carryovers in California', () => {
    it('applies ST loss carryover with $3,000 ordinary income limit', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 5000,
        priorYearShortTermLossCarryover: 10000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // $5k offsets ST gains, $3k offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(8000);
    });

    it('applies $1,500 limit for MFS loss carryover to ordinary income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 0,
        priorYearShortTermLossCarryover: 5000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.shortTermLossCarryoverOffset).toBe(1500);
    });

    it('LT loss carryover offsets capital gains (treated as ordinary in CA)', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 30000,
        priorYearLongTermLossCarryover: 20000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      // Gross should reflect the offset
      expect(result.grossIncome).toBe(80000); // 50k + 30k
    });
  });

  describe('California income vs federal income', () => {
    it('uses californiaIncome when specified instead of federalIncome', () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        californiaIncome: 120000, // Different CA-source income
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.wageIncome).toBe(120000);
      expect(result.grossIncome).toBe(120000);
    });

    it('falls back to federalIncome when californiaIncome is 0', () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        californiaIncome: 0,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.wageIncome).toBe(150000);
    });
  });

  describe('mental health tax edge cases', () => {
    it('applies mental health tax to MFJ income over $1M', () => {
      // MFJ with $2M income
      const inputs = createDefaultInputs({
        federalIncome: 2000000,
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // Taxable = $2M - $11,080 std = $1,988,920
      // Mental health = ($1,988,920 - $1M) * 1% = $9,889.20
      expect(result.ltcgTax).toBeCloseTo(9889.20, 2);
    });

    it('mental health tax applies to capital gains income too', () => {
      // $500k wages + $600k LTCG = $1.1M
      const inputs = createDefaultInputs({
        federalIncome: 500000,
        longTermCapitalGains: 600000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // Mental health tax should apply
      expect(result.ltcgTax).toBeGreaterThan(0);
    });
  });

  describe('California bracket calculations', () => {
    it('calculates tax correctly through multiple brackets', () => {
      // $100k income, single filer
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // Taxable = $100k - $5,540 = $94,460
      // Should span multiple brackets (1%, 2%, 4%, 6%, 8%, 9.3%)
      expect(result.taxableOrdinaryIncome).toBe(94460);
      expect(result.ordinaryIncomeBracketBreakdown.length).toBeGreaterThan(1);
    });

    it('handles top CA bracket (12.3%)', () => {
      // Very high income to hit 12.3% bracket (starts at $742,953 for single)
      const inputs = createDefaultInputs({
        federalIncome: 800000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      const topBracket = result.ordinaryIncomeBracketBreakdown.find(b => b.rate === 0.123);
      expect(topBracket).toBeDefined();
    });
  });

  describe('401k deduction in California', () => {
    it('reduces CA taxable income by 401k contributions', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      // Gross = $100k, after 401k and std ded: $100k - $23.5k - $5,540 = $70,960
      expect(result.contributions401k).toBe(23500);
      expect(result.taxableOrdinaryIncome).toBe(70960);
    });
  });

  describe('refund and remaining owed', () => {
    it('calculates CA refund correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 60000,
        californiaTaxWithheld: 5000,
        californiaEstimatedPaid: 2000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.totalPaid).toBe(7000);
      // Should have refund since $7k is likely more than CA tax on $60k
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it('calculates CA amount owed when underpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        californiaTaxWithheld: 5000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets as TaxBracketsData,
        californiaDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.totalPaid).toBe(5000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });
});
