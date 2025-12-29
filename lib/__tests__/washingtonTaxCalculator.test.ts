import { describe, it, expect } from 'vitest';
import { calculateWashingtonTax } from '../states/washingtonTaxCalculator';
import {
  washingtonBrackets,
  washingtonLimits,
  createDefaultInputs,
} from './testData';

describe('calculateWashingtonTax', () => {
  describe('LTCG-only taxation', () => {
    it('does not tax wages (WA has no income tax)', () => {
      // $200,000 wages, $0 capital gains → $0 WA tax
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        longTermCapitalGains: 0,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.ltcgTax).toBe(0);
    });

    it('does not tax short-term capital gains', () => {
      // $100,000 STCG → $0 WA tax (only LTCG is taxed)
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 100000,
        longTermCapitalGains: 0,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBe(0);
      expect(result.ltcgTax).toBe(0);
    });

    it('exempts first $278,000 of LTCG', () => {
      // $278,000 LTCG exactly → $0 WA tax (all within exemption)
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 278000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBe(0);
      expect(result.taxableLTCG).toBe(0);
    });

    it('applies 7% on LTCG over $278k exemption - exact calculation', () => {
      // $300,000 LTCG
      // Exempt: $278,000
      // Taxable: $300,000 - $278,000 = $22,000
      // Tax: $22,000 × 7% = $1,540
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 300000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.taxableLTCG).toBe(22000);
      expect(result.ltcgTax).toBeCloseTo(1540, 2);
      expect(result.totalTax).toBeCloseTo(1540, 2);
    });

    it('applies 7% rate up to $1M - exact calculation', () => {
      // $500,000 LTCG
      // Exempt: $278,000
      // Taxable at 7%: $500,000 - $278,000 = $222,000
      // Tax: $222,000 × 7% = $15,540
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 500000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.taxableLTCG).toBe(222000);
      expect(result.ltcgTax).toBeCloseTo(15540, 2);
      expect(result.totalTax).toBeCloseTo(15540, 2);
    });

    it('applies 9.9% surtax on LTCG over $1M - exact calculation', () => {
      // $1,200,000 LTCG
      // Tier 1: $0 - $278,000 @ 0% = $0
      // Tier 2: $278,000 - $1,000,000 @ 7% = $722,000 × 0.07 = $50,540
      // Tier 3: $1,000,000 - $1,200,000 @ 9.9% = $200,000 × 0.099 = $19,800
      // Total tax: $50,540 + $19,800 = $70,340
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 1200000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.taxableLTCG).toBe(922000); // $1.2M - $278k exemption
      expect(result.ltcgTax).toBe(70340);
      expect(result.totalTax).toBe(70340);
    });

    it('applies 7% at exactly $1M - boundary test', () => {
      // $1,000,000 LTCG exactly
      // Tier 1: $0 - $278,000 @ 0% = $0
      // Tier 2: $278,000 - $1,000,000 @ 7% = $722,000 × 0.07 = $50,540
      // No surtax (at boundary, not over)
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 1000000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.ltcgTax).toBeCloseTo(50540, 2);
      expect(result.totalTax).toBeCloseTo(50540, 2);
    });

    it('applies 9.9% starting at $1,000,001 - boundary test', () => {
      // $1,000,001 LTCG (one dollar over)
      // Tier 1: $0 - $278,000 @ 0% = $0
      // Tier 2: $278,000 - $1,000,000 @ 7% = $722,000 × 0.07 = $50,540
      // Tier 3: $1 @ 9.9% = $0.099 (rounds to ~$0.10)
      // Total: $50,540.10
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 1000001,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.ltcgTax).toBeCloseTo(50540.10, 2);
    });
  });

  describe('capital loss carryover', () => {
    it('applies LT carryover to reduce taxable LTCG', () => {
      // $400,000 LTCG with $50,000 LT loss carryover
      // Net LTCG: $400,000 - $50,000 = $350,000
      // Taxable: $350,000 - $278,000 = $72,000
      // Tax: $72,000 × 7% = $5,040
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 400000,
        priorYearLongTermLossCarryover: 50000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.longTermLossCarryoverOffset).toBe(50000);
      expect(result.taxableLTCG).toBe(72000);
      expect(result.ltcgTax).toBeCloseTo(5040, 2);
    });

    it('LT carryover can eliminate all taxable gains', () => {
      // $300,000 LTCG with $300,000 LT loss carryover
      // Net LTCG: $0
      // Tax: $0
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 300000,
        priorYearLongTermLossCarryover: 300000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.longTermLossCarryoverOffset).toBe(300000);
      expect(result.taxableLTCG).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('ST carryover does NOT reduce LTCG (WA taxes LTCG only)', () => {
      // $400,000 LTCG with $100,000 ST loss carryover
      // ST carryover is not applied (WA doesn't tax STCG)
      // Net LTCG: $400,000 (unchanged)
      // Taxable: $400,000 - $278,000 = $122,000
      // Tax: $122,000 × 7% = $8,540
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 400000,
        priorYearShortTermLossCarryover: 100000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.shortTermLossCarryoverOffset).toBe(0);
      expect(result.taxableLTCG).toBe(122000);
      expect(result.ltcgTax).toBeCloseTo(8540, 2);
    });
  });

  describe('negative capital gains (current year losses)', () => {
    it('treats negative LTCG as $0 (no tax)', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -50000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBe(0);
      expect(result.longTermCapitalGains).toBe(-50000); // Original preserved
    });
  });

  describe('safe harbor', () => {
    it('uses 80% of current year only (no prior year comparison)', () => {
      // $500,000 LTCG → $15,540 tax
      // Safe harbor: $15,540 × 80% = $12,432
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 500000,
        priorYearStateTaxPaid: 50000, // Should be ignored
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(12432, 0); // 80% not 90%
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(0); // No prior year in WA
      expect(result.safeHarbor!.minimum).toBeCloseTo(12432, 0);
    });

    it('safe harbor is met when paid >= 80% of current year tax', () => {
      // $500,000 LTCG → $15,540 tax
      // Safe harbor minimum: $12,432
      // Paid: $13,000 → safe harbor met
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 500000,
        stateEstimatedPaid: 13000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.safeHarbor!.met).toBe(true);
      expect(result.safeHarbor!.remaining).toBe(0);
    });

    it('safe harbor is not met when paid < 80% of current year tax', () => {
      // $500,000 LTCG → $15,540 tax
      // Safe harbor minimum: $12,432
      // Paid: $10,000 → safe harbor NOT met
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 500000,
        stateEstimatedPaid: 10000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.safeHarbor!.met).toBe(false);
      expect(result.safeHarbor!.remaining).toBeCloseTo(2432, 0); // $12,432 - $10,000
    });
  });

  describe('filing status (all use same thresholds)', () => {
    it('MFJ uses same $278k exemption as single', () => {
      // WA uses same thresholds for all filing statuses
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 300000,
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      // Same calculation as single: ($300k - $278k) × 7% = $1,540
      expect(result.ltcgTax).toBeCloseTo(1540, 2);
    });

    it('MFS uses same $278k exemption as single', () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 300000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.ltcgTax).toBeCloseTo(1540, 2);
    });
  });

  describe('payment summary', () => {
    it('calculates remaining owed correctly', () => {
      // $500,000 LTCG → $15,540 tax, paid $10,000
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 500000,
        stateEstimatedPaid: 10000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBeCloseTo(15540, 2);
      expect(result.totalPaid).toBe(10000);
      expect(result.remainingOwed).toBeCloseTo(5540, 2);
      expect(result.refundDue).toBe(0);
    });

    it('calculates refund when overpaid', () => {
      // $300,000 LTCG → $1,540 tax, paid $5,000
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 300000,
        stateEstimatedPaid: 5000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBeCloseTo(1540, 2);
      expect(result.totalPaid).toBe(5000);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBeCloseTo(3460, 2);
    });
  });

  describe('edge cases', () => {
    it('handles zero income', () => {
      const inputs = createDefaultInputs();

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.totalTax).toBe(0);
      expect(result.grossIncome).toBe(0);
    });

    it('bracket breakdown shows correct structure', () => {
      // $1,200,000 LTCG - should have 3 bracket entries
      const inputs = createDefaultInputs({
        longTermCapitalGains: 1200000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.ltcgBracketBreakdown.length).toBe(3);

      // Verify each bracket
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0);
      expect(result.ltcgBracketBreakdown[0].incomeInBracket).toBe(278000);
      expect(result.ltcgBracketBreakdown[0].taxForBracket).toBe(0);

      expect(result.ltcgBracketBreakdown[1].rate).toBe(0.07);
      expect(result.ltcgBracketBreakdown[1].incomeInBracket).toBe(722000);
      expect(result.ltcgBracketBreakdown[1].taxForBracket).toBeCloseTo(50540, 2);

      expect(result.ltcgBracketBreakdown[2].rate).toBe(0.099);
      expect(result.ltcgBracketBreakdown[2].incomeInBracket).toBe(200000);
      expect(result.ltcgBracketBreakdown[2].taxForBracket).toBeCloseTo(19800, 2);
    });

    it('uses stateIncome when specified', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        stateIncome: 100000,
        longTermCapitalGains: 300000,
        filingStatus: 'single',
      });

      const result = calculateWashingtonTax(inputs, washingtonBrackets, washingtonLimits);

      expect(result.wageIncome).toBe(100000);
      // But wages don't affect tax - only LTCG matters
      expect(result.ltcgTax).toBeCloseTo(1540, 2);
    });
  });
});
