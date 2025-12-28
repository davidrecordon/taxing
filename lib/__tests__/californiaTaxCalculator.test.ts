import { describe, it, expect } from 'vitest';
import { calculateCaliforniaTax } from '../states/californiaTaxCalculator';
import {
  californiaBrackets,
  californiaDeductions,
  sharedLimits,
  californiaLimits,
  createDefaultInputs,
} from './testData';

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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Calculate expected: income - std deduction = $1,094,460
      // Mental health tax = ($1,094,460 - $1,000,000) * 0.01 = $944.60
      expect(result.caMentalHealthTax).toBeCloseTo(944.60, 2);
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.caMentalHealthTax).toBe(0);
    });
  });

  describe('safe harbor with high income exception', () => {
    it('only uses 90% current year method for high income taxpayers (AGI > $1M)', () => {
      // Single filer with $1,500,000 income
      // AGI > $1M, so high income exception applies
      // Cannot use 100% prior year method
      const inputs = createDefaultInputs({
        federalIncome: 1500000,
        priorYearStateTaxPaid: 50000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        priorYearStateTaxPaid: 100000, // High prior year to make 100% method more favorable
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        priorYearStateTaxPaid: 20000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.safeHarbor!.highIncomeException).toBe(true);
    });

    it('MFJ uses $1M threshold for high income exception', () => {
      // $900k AGI is under $1M threshold for MFJ
      const inputs = createDefaultInputs({
        federalIncome: 900000,
        priorYearStateTaxPaid: 30000,
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      // Gross should reflect the offset
      expect(result.grossIncome).toBe(80000); // 50k + 30k
    });
  });

  describe('California income vs federal income', () => {
    it('uses stateIncome when specified instead of federalIncome', () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        stateIncome: 120000, // Different CA-source income
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.wageIncome).toBe(120000);
      expect(result.grossIncome).toBe(120000);
    });

    it('falls back to federalIncome when stateIncome is 0', () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        stateIncome: 0,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Taxable = $2M - $11,080 std = $1,988,920
      // Mental health = ($1,988,920 - $1M) * 1% = $9,889.20
      expect(result.caMentalHealthTax).toBeCloseTo(9889.20, 2);
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Mental health tax should apply
      expect(result.caMentalHealthTax).toBeGreaterThan(0);
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
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
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Gross = $100k, after 401k and std ded: $100k - $23.5k - $5,540 = $70,960
      expect(result.contributions401k).toBe(23500);
      expect(result.taxableOrdinaryIncome).toBe(70960);
    });
  });

  describe('pre-tax medical deduction in California', () => {
    it('reduces CA taxable income by pre-tax medical contributions', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        preTaxMedical: 10000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Gross = $100k, after pre-tax medical and std ded: $100k - $10k - $5,540 = $84,460
      expect(result.preTaxMedical).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(84460);
    });

    it('combines with 401k to reduce CA taxable income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 20000,
        preTaxMedical: 5000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Gross = $100k, after both deductions: $100k - $20k - $5k - $5,540 = $69,460
      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.taxableOrdinaryIncome).toBe(69460);
    });
  });

  describe('refund and remaining owed', () => {
    it('calculates CA refund correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 60000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 2000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.totalPaid).toBe(7000);
      // Should have refund since $7k is likely more than CA tax on $60k
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it('calculates CA amount owed when underpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        stateTaxWithheld: 5000,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.totalPaid).toBe(5000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('applies mental health tax at exactly $1,000,000.01 over threshold', () => {
      // Taxable income just barely over $1M threshold
      // $1,005,540.01 - $5,540 std deduction = $1,000,000.01 taxable
      const inputs = createDefaultInputs({
        federalIncome: 1005540.01,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Mental health tax = $0.01 * 1% = $0.0001 (rounds to ~0)
      expect(result.caMentalHealthTax).toBeCloseTo(0.0001, 4);
    });

    it('handles zero CA income with federal income (uses federal as fallback)', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateIncome: 0,
        filingStatus: 'single',
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      // Should fall back to federal income
      expect(result.wageIncome).toBe(100000);
      expect(result.grossIncome).toBe(100000);
    });

    it('handles all inputs at zero', () => {
      const inputs = createDefaultInputs();

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits
      );

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.caMentalHealthTax).toBe(0);
    });
  });
});
