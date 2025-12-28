import { describe, it, expect } from 'vitest';
import { calculateIllinoisTax } from '../states/illinoisTaxCalculator';
import {
  illinoisBrackets,
  illinoisDeductions,
  sharedLimits,
  illinoisLimits,
  createDefaultInputs,
} from './testData';

describe('calculateIllinoisTax', () => {
  describe('flat rate calculation', () => {
    it('calculates tax at 4.95% flat rate', () => {
      // $100,000 income - $2,850 personal exemption = $97,150 taxable
      // Tax = $97,150 * 4.95% = $4,808.93 (rounded)
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.taxableOrdinaryIncome).toBe(97150);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4808.93, 0);
      expect(result.totalTax).toBeCloseTo(4808.93, 0);
    });

    it('applies correct personal exemption for MFJ', () => {
      // $100,000 income - $5,700 personal exemption (MFJ) = $94,300 taxable
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: 'illinois',
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.taxableOrdinaryIncome).toBe(94300);
      expect(result.deductionBreakdown.deductionAmount).toBe(5700);
    });

    it('applies correct personal exemption for MFS', () => {
      // $100,000 income - $2,850 personal exemption (MFS) = $97,150 taxable
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: 'illinois',
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.taxableOrdinaryIncome).toBe(97150);
      expect(result.deductionBreakdown.deductionAmount).toBe(2850);
    });
  });

  describe('capital gains treatment', () => {
    it('taxes all capital gains as ordinary income', () => {
      // $50,000 wages + $25,000 STCG + $25,000 LTCG = $100,000 gross
      // - $2,850 exemption = $97,150 taxable
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 25000,
        longTermCapitalGains: 25000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.grossIncome).toBe(100000);
      expect(result.taxableOrdinaryIncome).toBe(97150);
      expect(result.ltcgTax).toBe(0); // No separate LTCG treatment
    });
  });

  describe('capital loss carryover', () => {
    it('applies short-term loss carryover correctly', () => {
      // $100,000 wages, $10,000 ST carryover
      // Carryover offsets $3,000 ordinary income (no ST gains to offset)
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearShortTermLossCarryover: 10000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      // $100,000 - $3,000 carryover - $2,850 exemption = $94,150
      expect(result.taxableOrdinaryIncome).toBe(94150);
    });

    it('applies long-term loss carryover correctly', () => {
      // $50,000 wages + $20,000 LTCG, $30,000 LT carryover
      // LT carryover offsets the $20,000 LTCG
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 30000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      // $50,000 + $20,000 LTCG - $20,000 offset - $2,850 exemption = $47,150
      expect(result.taxableOrdinaryIncome).toBe(47150);
    });
  });

  describe('negative capital gains (current year losses)', () => {
    it('combines negative STCG with prior year carryover', () => {
      // $100,000 wages, -$5,000 STCG (current year loss), $2,000 prior carryover
      // Combined = $7,000 carryover, $3,000 offsets ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: -5000,
        priorYearShortTermLossCarryover: 2000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.grossIncome).toBe(100000); // Negative STCG not included
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(4000);
    });

    it('treats negative LTCG as $0 for tax calculation', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -20000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.grossIncome).toBe(100000); // Negative LTCG not subtracted
      expect(result.longTermCapitalGains).toBe(-20000); // Original value preserved
    });
  });

  describe('pre-tax deductions', () => {
    it('applies 401k and pre-tax medical deductions', () => {
      // $100,000 wages - $10,000 401k - $5,000 medical - $2,850 exemption = $82,150
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 10000,
        preTaxMedical: 5000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.contributions401k).toBe(10000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.taxableOrdinaryIncome).toBe(82150);
    });
  });

  describe('safe harbor', () => {
    it('calculates safe harbor correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 5000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.safeHarbor).toBeDefined();
      // 90% of current year tax
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(result.totalTax * 0.9, 0);
      // 100% of prior year tax
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(5000);
    });
  });

  describe('payment summary', () => {
    it('calculates remaining owed correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 3000,
        stateEstimatedPaid: 1000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.totalPaid).toBe(4000);
      // Tax = ~$4,809, paid $4,000, owed ~$809
      expect(result.remainingOwed).toBeCloseTo(809, -1);
      expect(result.refundDue).toBe(0);
    });

    it('calculates refund correctly when overpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        stateTaxWithheld: 5000,
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      // Tax = ~$2,334, paid $5,000
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles zero income', () => {
      const inputs = createDefaultInputs({
        selectedState: 'illinois',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.grossIncome).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('handles income less than personal exemption', () => {
      const inputs = createDefaultInputs({
        federalIncome: 2000, // Less than $2,850 exemption
        selectedState: 'illinois',
        filingStatus: 'single',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('falls back to federal income when state income is not specified', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateIncome: 0,
        selectedState: 'illinois',
      });

      const result = calculateIllinoisTax(
        inputs,
        illinoisBrackets,
        illinoisDeductions,
        sharedLimits,
        illinoisLimits
      );

      expect(result.wageIncome).toBe(100000);
    });
  });
});
