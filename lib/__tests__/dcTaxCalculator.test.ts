import { describe, it, expect } from 'vitest';
import { calculateDCTax } from '../states/dcTaxCalculator';
import {
  dcBrackets,
  dcDeductions,
  dcLimits,
  sharedLimits,
  federalLimits,
  ficaData,
  createDefaultInputs,
} from './testData';

describe('calculateDCTax', () => {
  describe('progressive bracket calculation', () => {
    it('calculates tax correctly for income in first bracket', () => {
      const inputs = createDefaultInputs({
        federalIncome: 8000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // $8k income, $15k standard deduction = $0 taxable
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('calculates tax for income in middle brackets', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // $100k - $15k standard deduction = $85k taxable
      // First $10k @ 4% = $400
      // $10k - $40k (30k) @ 6% = $1,800
      // $40k - $60k (20k) @ 6.5% = $1,300
      // $60k - $85k (25k) @ 8.5% = $2,125
      // Total = $5,625
      expect(result.taxableOrdinaryIncome).toBe(85000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(5625, 0);
    });

    it('calculates tax for high income in top bracket', () => {
      const inputs = createDefaultInputs({
        federalIncome: 2000000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // $2M - $15k deduction = $1,985,000 taxable
      // First $10k @ 4% = $400
      // $10k - $40k @ 6% = $1,800
      // $40k - $60k @ 6.5% = $1,300
      // $60k - $250k @ 8.5% = $16,150
      // $250k - $500k @ 9.25% = $23,125
      // $500k - $1M @ 9.75% = $48,750
      // $1M - $1.985M @ 10.75% = $105,887.50
      // Total = ~$197,412.50
      expect(result.taxableOrdinaryIncome).toBe(1985000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(197412.5, 0);
    });
  });

  describe('filing status handling', () => {
    it('uses same brackets for all filing statuses', () => {
      const singleInputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const mfjInputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: 'dc',
        filingStatus: 'marriedFilingJointly',
      });

      const singleResult = calculateDCTax(
        singleInputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      const mfjResult = calculateDCTax(
        mfjInputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // Same income but different standard deductions
      // Single: $100k - $15k = $85k taxable
      // MFJ: $100k - $30k = $70k taxable
      expect(singleResult.taxableOrdinaryIncome).toBe(85000);
      expect(mfjResult.taxableOrdinaryIncome).toBe(70000);

      // MFJ should have lower tax due to higher standard deduction
      expect(mfjResult.totalTax).toBeLessThan(singleResult.totalTax);
    });

    it('applies MFS standard deduction correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        selectedState: 'dc',
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // $50k - $15k MFS standard deduction = $35k taxable
      expect(result.taxableOrdinaryIncome).toBe(35000);
      expect(result.deductionBreakdown.standardDeduction).toBe(15000);
    });
  });

  describe('capital gains treatment', () => {
    it('taxes capital gains as ordinary income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 50000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // $100k gross - $15k deduction = $85k taxable
      expect(result.grossIncome).toBe(100000);
      expect(result.taxableOrdinaryIncome).toBe(85000);
      expect(result.ltcgTax).toBe(0); // No separate LTCG treatment
    });

    it('applies capital loss carryover correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 10000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // Gross = $120k, less $10k LTCG offset, less $15k deduction = $95k taxable
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(95000);
    });
  });

  describe('safe harbor', () => {
    it('calculates safe harbor correctly (90%/110%)', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 5000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      expect(result.safeHarbor).toBeDefined();
      // 90% of current year tax
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(result.totalTax * 0.9, 0);
      // 110% of prior year tax
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(5500);
    });

    it('safe harbor met when fully paid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 6000,
        priorYearStateTaxPaid: 5000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // Tax is ~$5,625, paid $6,000
      expect(result.safeHarbor!.met).toBe(true);
    });
  });

  describe('payment summary', () => {
    it('calculates remaining owed correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 3000,
        stateEstimatedPaid: 1000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      expect(result.totalPaid).toBe(4000);
      // Tax = ~$5,625, paid $4,000, owed ~$1,625
      expect(result.remainingOwed).toBeCloseTo(1625, 0);
      expect(result.refundDue).toBe(0);
    });

    it('calculates refund correctly when overpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        stateTaxWithheld: 5000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // $50k - $15k = $35k taxable
      // Tax = ~$2,100, paid $5,000
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe('deductions', () => {
    it('uses itemized when greater than standard', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        mortgageInterestPaid: 20000,
        charitableContributions: 10000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // Itemized = $30k > $15k standard
      expect(result.deductionBreakdown.deductionUsed).toBe('itemized');
      expect(result.deductionBreakdown.deductionAmount).toBe(30000);
      expect(result.taxableOrdinaryIncome).toBe(170000);
    });

    it('does not include SALT in itemized deductions', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        propertyTaxesPaid: 15000,
        stateTaxWithheld: 10000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // DC doesn't allow SALT deduction
      expect(result.deductionBreakdown.saltDeduction).toBe(0);
      // Should use standard deduction since no other itemized
      expect(result.deductionBreakdown.deductionUsed).toBe('standard');
    });
  });

  describe('edge cases', () => {
    it('handles zero income', () => {
      const inputs = createDefaultInputs({
        selectedState: 'dc',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('handles self-employment income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        selfEmploymentIncome: 50000,
        selectedState: 'dc',
        filingStatus: 'single',
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData
      );

      // SE income included in gross, with deductible SE tax
      expect(result.grossIncome).toBe(100000);
      expect(result.selfEmploymentIncome).toBe(50000);
      expect(result.deductibleSETax).toBeGreaterThan(0);
    });
  });
});
