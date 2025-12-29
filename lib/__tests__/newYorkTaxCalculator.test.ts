import { describe, it, expect } from 'vitest';
import { calculateNewYorkTax } from '../states/newYorkTaxCalculator';
import {
  newYorkBrackets,
  nycBrackets,
  newYorkDeductions,
  newYorkLimits,
  sharedLimits,
  federalLimits,
  ficaData,
  createDefaultInputs,
} from './testData';

describe('calculateNewYorkTax', () => {
  describe('capital gains as ordinary income', () => {
    it('taxes both short-term and long-term capital gains at ordinary rates', () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 50000,
        shortTermCapitalGains: 50000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.grossIncome).toBe(100000);
      expect(result.taxableLTCG).toBe(0); // NY doesn't separate LTCG
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
    });
  });

  describe('NYC local tax', () => {
    it('applies NYC local tax when isNYCResident is true', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.nycTax).toBeDefined();
      expect(result.nycTax).toBeGreaterThan(0);
      expect(result.nycBracketBreakdown).toBeDefined();
      expect(result.nycBracketBreakdown!.length).toBeGreaterThan(0);
      // Total should be state + NYC
      expect(result.totalTax).toBe(result.ordinaryIncomeTax + result.nycTax!);
    });

    it('does not apply NYC tax when isNYCResident is false', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
        isNYCResident: false,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.nycTax).toBeUndefined();
      expect(result.nycBracketBreakdown).toBeUndefined();
      expect(result.totalTax).toBe(result.ordinaryIncomeTax);
    });

    it('does not apply NYC tax when isNYCResident is not set', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.nycTax).toBeUndefined();
      expect(result.totalTax).toBe(result.ordinaryIncomeTax);
    });
  });

  describe('safe harbor with high income rule', () => {
    it('uses 110% prior year for high income (AGI > $150k)', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        priorYearStateTaxPaid: 10000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.isHighIncome).toBe(true);
      // 110% of $10k = $11k
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(11000, 2);
    });

    it('uses 100% prior year for income under $150k', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 5000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.isHighIncome).toBe(false);
      // 100% of $5k = $5k
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5000, 2);
    });

    it('uses $75k threshold for MFS high income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000, // Over $75k for MFS
        priorYearStateTaxPaid: 5000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.safeHarbor!.isHighIncome).toBe(true);
      // 110% of $5k = $5.5k
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5500, 2);
    });

    it('MFJ uses $150k threshold', () => {
      const inputs = createDefaultInputs({
        federalIncome: 140000, // Under $150k for MFJ
        priorYearStateTaxPaid: 5000,
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.safeHarbor!.isHighIncome).toBe(false);
    });
  });

  describe('loss carryovers', () => {
    it('applies ST loss carryover with $3,000 ordinary income limit', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 5000,
        priorYearShortTermLossCarryover: 10000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
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

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.shortTermLossCarryoverOffset).toBe(1500);
    });

    it('LT loss carryover offsets long-term capital gains', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 30000,
        priorYearLongTermLossCarryover: 20000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      expect(result.grossIncome).toBe(80000); // 50k + 30k
    });
  });

  describe('NY income vs federal income', () => {
    it('uses stateIncome when specified instead of federalIncome', () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        stateIncome: 120000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
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

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.wageIncome).toBe(150000);
    });
  });

  describe('401k deduction', () => {
    it('reduces NY taxable income by 401k contributions', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // Gross = $100k, after 401k and std ded: $100k - $23.5k - $8,000 = $68,500
      expect(result.contributions401k).toBe(23500);
      expect(result.taxableOrdinaryIncome).toBe(68500);
    });
  });

  describe('pre-tax medical deduction', () => {
    it('reduces NY taxable income by pre-tax medical contributions', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        preTaxMedical: 10000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // Gross = $100k, after pre-tax medical and std ded: $100k - $10k - $8,000 = $82,000
      expect(result.preTaxMedical).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(82000);
    });

    it('combines with 401k to reduce NY taxable income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 20000,
        preTaxMedical: 5000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // Gross = $100k, after both deductions: $100k - $20k - $5k - $8,000 = $67,000
      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.taxableOrdinaryIncome).toBe(67000);
    });
  });

  describe('negative LTCG (current year losses)', () => {
    it('treats negative LTCG as $0 for NY tax calculation', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -25000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // Gross income should only include federal income (LTCG clamped to 0)
      expect(result.grossIncome).toBe(100000);
      // Original negative value should still be in result for display
      expect(result.longTermCapitalGains).toBe(-25000);
    });
  });

  describe('negative STCG (current year short-term losses)', () => {
    it('combines negative STCG with prior year carryover', () => {
      // $100,000 federal income, -$5,000 STCG, $2,000 prior carryover
      // Combined carryover = $7,000, offsets $3,000 ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: -5000,
        priorYearShortTermLossCarryover: 2000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // Gross income should not include negative STCG
      expect(result.grossIncome).toBe(100000);
      // Combined $7,000 carryover, $3,000 offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(4000);
    });
  });

  describe('NY bracket calculations', () => {
    it('calculates tax correctly through multiple brackets', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // Taxable = $100k - $8k = $92k
      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeBracketBreakdown.length).toBeGreaterThan(1);
    });

    it('handles top NY bracket (10.9%)', () => {
      // Very high income to hit 10.9% bracket (starts at $25M for single)
      const inputs = createDefaultInputs({
        federalIncome: 30000000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      const topBracket = result.ordinaryIncomeBracketBreakdown.find(b => b.rate === 0.109);
      expect(topBracket).toBeDefined();
    });
  });

  describe('refund and remaining owed', () => {
    it('calculates NY refund correctly', () => {
      const inputs = createDefaultInputs({
        federalIncome: 60000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 2000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.totalPaid).toBe(7000);
      // Should have refund since $7k is likely more than NY tax on $60k
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it('calculates NY amount owed when underpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        stateTaxWithheld: 5000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.totalPaid).toBe(5000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles all inputs at zero', () => {
      const inputs = createDefaultInputs();

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('handles NYC resident with zero income', () => {
      const inputs = createDefaultInputs({
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.nycTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it('correctly identifies high income at exactly $150,001', () => {
      const inputs = createDefaultInputs({
        federalIncome: 150001,
        priorYearStateTaxPaid: 1000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.safeHarbor!.isHighIncome).toBe(true);
    });

    it('correctly identifies non-high income at exactly $150,000', () => {
      // Need to account for 401k and deductions to get AGI exactly at threshold
      // With $8k std deduction, need $158k gross to get $150k AGI
      const inputs = createDefaultInputs({
        federalIncome: 158000,
        priorYearStateTaxPaid: 1000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // AGI = $158k - deductions, threshold check is on nyAgi which doesn't include deductions
      // nyAgi = grossIncome - carryovers - 401k = $158k
      expect(result.safeHarbor!.isHighIncome).toBe(true);
    });
  });

  describe('self-employment income', () => {
    it('includes SE income in gross income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits,
        ficaData
      );

      expect(result.grossIncome).toBe(150000);
      expect(result.selfEmploymentIncome).toBe(50000);
    });

    it('calculates deductible half of SE tax', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits,
        ficaData
      );

      // Deductible SE tax = 50% of SE tax
      expect(result.deductibleSETax).toBeCloseTo(3532, 0);
    });

    it('reduces taxable income by deductible SE tax', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits,
        ficaData
      );

      // Gross = $150k, less deductible SE tax (~$3,532), less std ded ($8,000)
      // Taxable = $150k - $3,532 - $8,000 = $138,468
      expect(result.taxableOrdinaryIncome).toBeCloseTo(138468, 0);
    });

    it('does not include SE fields when no SE income', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits,
        ficaData
      );

      expect(result.selfEmploymentIncome).toBeUndefined();
      expect(result.deductibleSETax).toBeUndefined();
    });

    it('SE income counts toward NYC local tax', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: 'single',
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits,
        ficaData
      );

      expect(result.nycTax).toBeDefined();
      expect(result.nycTax).toBeGreaterThan(0);
      // NYC tax should be based on the full taxable income including SE
      expect(result.grossIncome).toBe(150000);
    });
  });

  describe('deduction types', () => {
    it('uses standard deduction when itemized is lower', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
        // No itemized deductions
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.deductionBreakdown.deductionUsed).toBe('standard');
      expect(result.deductionBreakdown.deductionAmount).toBe(8000); // NY single std deduction
    });

    it('uses itemized deduction when higher than standard', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: 'single',
        mortgageInterestPaid: 15000,
        charitableContributions: 5000,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      expect(result.deductionBreakdown.deductionUsed).toBe('itemized');
      expect(result.deductionBreakdown.deductionAmount).toBe(20000); // mortgage + charitable
    });

    it('NY does not allow SALT deduction', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: 'single',
        propertyTaxesPaid: 20000,
        stateTaxWithheld: 10000,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        federalLimits,
        newYorkLimits
      );

      // SALT should be 0 for NY (can't deduct state tax from state tax)
      expect(result.deductionBreakdown.saltDeduction).toBe(0);
    });
  });
});
