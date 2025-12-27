import { describe, it, expect } from 'vitest';
import { calculateFederalTax } from '../federalTaxCalculator';
import {
  federalBrackets,
  ltcgBrackets,
  federalDeductions,
  limits,
  ficaData,
  createDefaultInputs,
} from './testData';

describe('calculateFederalTax', () => {
  describe('basic bracket math', () => {
    it('calculates tax correctly for single filer with $100,000 W-2 income', () => {
      // $100,000 income - $15,700 standard deduction = $84,300 taxable
      // Bracket breakdown:
      // $11,925 @ 10% = $1,192.50
      // $36,550 ($48,475 - $11,925) @ 12% = $4,386.00
      // $35,825 ($84,300 - $48,475) @ 22% = $7,881.50
      // Total ordinary income tax = $13,460
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.taxableOrdinaryIncome).toBe(84300);
      expect(result.ordinaryIncomeTax).toBe(13460);
    });
  });

  describe('FICA taxes', () => {
    it('caps Social Security tax at wage base and applies additional Medicare above threshold', () => {
      // $250,000 wages for single filer
      // SS: $168,600 * 6.2% = $10,453.20
      // Medicare base: $250,000 * 1.45% = $3,625
      // Additional Medicare: ($250,000 - $200,000) * 0.9% = $450
      // Total FICA = $14,528.20
      const inputs = createDefaultInputs({
        federalIncome: 250000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.ficaBreakdown).toBeDefined();
      expect(result.ficaBreakdown!.socialSecurityWages).toBe(176100);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(10918.20, 2);
      expect(result.ficaBreakdown!.medicareTax).toBeCloseTo(3625, 2);
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(450, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(14993.20, 2);
    });
  });

  describe('long-term capital gains', () => {
    it('applies preferential 0% rate for LTCG within bracket threshold', () => {
      // Single filer with $30,000 LTCG and no ordinary income
      // LTCG bracket: $47,025 at 0%, so $30,000 is all at 0%
      const inputs = createDefaultInputs({
        longTermCapitalGains: 30000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.taxableLTCG).toBe(30000);
      expect(result.ltcgTax).toBe(0);
    });

    it('applies 15% rate for LTCG above 0% threshold', () => {
      // Single filer with $100,000 LTCG and no ordinary income
      // LTCG: $47,025 at 0% = $0, $52,975 at 15% = $7,946.25
      const inputs = createDefaultInputs({
        longTermCapitalGains: 100000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.taxableLTCG).toBe(100000);
      expect(result.ltcgTax).toBeCloseTo(7946.25, 2);
    });
  });

  describe('401k contributions', () => {
    it('reduces taxable ordinary income by 401k contributions', () => {
      // $100,000 income - $23,500 (401k) - $15,700 (std deduction) = $60,800 taxable
      // Bracket breakdown:
      // $11,925 @ 10% = $1,192.50
      // $36,550 @ 12% = $4,386.00
      // $12,325 ($60,800 - $48,475) @ 22% = $2,711.50
      // Total = $8,290
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.taxableOrdinaryIncome).toBe(60800);
      expect(result.ordinaryIncomeTax).toBe(8290);
    });
  });

  describe('safe harbor calculations', () => {
    it('uses minimum of 90% current year and 110% prior year when prior year provided', () => {
      // $100k income, tax is $13,460 + FICA
      // FICA: $100k * 6.2% = $6,200 (SS) + $100k * 1.45% = $1,450 (Medicare) = $7,650
      // Total tax = $13,460 + $7,650 = $21,110
      // 90% of current year = $18,999
      // Prior year tax = $15,000, so 110% = $16,500
      // Safe harbor minimum should be $16,500 (the lesser of the two)
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearFederalTaxPaid: 15000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(21110 * 0.9, 2);
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(16500);
      expect(result.safeHarbor!.minimum).toBe(16500);
    });

    it('uses only 90% current year when no prior year tax provided', () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearFederalTaxPaid: 0,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.minimum).toBeCloseTo(result.totalTax * 0.9, 2);
    });
  });

  describe('short-term loss carryover edge cases', () => {
    it('offsets ST gains first, then ordinary income up to $3,000 limit', () => {
      // $50,000 wage income, $10,000 ST gains, $15,000 ST loss carryover
      // ST loss first offsets $10,000 ST gains, leaving $5,000 carryover
      // Then $3,000 of remaining carryover offsets ordinary income
      // Gross ordinary = $50,000 + $10,000 - $10,000 - $3,000 = $47,000
      // After std deduction: $47,000 - $15,700 = $31,300 taxable
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 10000,
        priorYearShortTermLossCarryover: 15000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.shortTermLossCarryoverOffset).toBe(13000); // 10k ST + 3k ordinary
      expect(result.taxableOrdinaryIncome).toBe(31300);
    });

    it('limits ordinary income offset to $1,500 for MFS', () => {
      // MFS gets only $1,500 limit instead of $3,000
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 0,
        priorYearShortTermLossCarryover: 5000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      // Only $1,500 can offset ordinary income for MFS
      expect(result.shortTermLossCarryoverOffset).toBe(1500);
    });

    it('does not apply loss carryover when no income to offset', () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        shortTermCapitalGains: 0,
        priorYearShortTermLossCarryover: 10000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.shortTermLossCarryoverOffset).toBe(0);
    });
  });

  describe('long-term loss carryover edge cases', () => {
    it('offsets only LTCG, not ordinary income', () => {
      // $100,000 wage income, $20,000 LTCG, $50,000 LT loss carryover
      // LT loss only offsets the $20,000 LTCG, NOT ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 50000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      expect(result.taxableLTCG).toBe(0);
      // Ordinary income should be unaffected
      expect(result.taxableOrdinaryIncome).toBe(84300); // 100k - 15.7k std
    });

    it('partially offsets LTCG when carryover is less than gains', () => {
      const inputs = createDefaultInputs({
        longTermCapitalGains: 100000,
        priorYearLongTermLossCarryover: 30000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.longTermLossCarryoverOffset).toBe(30000);
      expect(result.taxableLTCG).toBe(70000);
    });
  });

  describe('combined ST and LT loss carryovers', () => {
    it('applies both ST and LT carryovers correctly', () => {
      // Complex scenario: wage income + both types of gains + both types of losses
      const inputs = createDefaultInputs({
        federalIncome: 80000,
        shortTermCapitalGains: 15000,
        longTermCapitalGains: 25000,
        priorYearShortTermLossCarryover: 20000, // exceeds ST gains
        priorYearLongTermLossCarryover: 10000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      // ST loss: $15k offsets ST gains, $3k offsets ordinary income = $18k used
      expect(result.shortTermLossCarryoverOffset).toBe(18000);
      // LT loss: $10k offsets LTCG
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.taxableLTCG).toBe(15000); // 25k - 10k
    });
  });

  describe('bracket boundary edge cases', () => {
    it('taxes income exactly at first bracket boundary correctly', () => {
      // Taxable income exactly $11,925 (top of 10% bracket)
      // Need gross = $11,925 + $15,700 std = $27,625
      const inputs = createDefaultInputs({
        federalIncome: 27625,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.taxableOrdinaryIncome).toBe(11925);
      expect(result.ordinaryIncomeTax).toBe(1192.5); // all at 10%
    });

    it('taxes $1 over bracket boundary at higher rate', () => {
      // Taxable income $11,926 - $1 in 12% bracket
      const inputs = createDefaultInputs({
        federalIncome: 27626,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.taxableOrdinaryIncome).toBe(11926);
      // $11,925 @ 10% + $1 @ 12% = $1,192.50 + $0.12 = $1,192.62
      expect(result.ordinaryIncomeTax).toBeCloseTo(1192.62, 2);
    });

    it('handles top bracket (37%) with no upper limit', () => {
      // Very high income in top bracket
      // Single: top bracket starts at $626,350
      // Taxable = $700,000, so need gross = $715,700
      const inputs = createDefaultInputs({
        federalIncome: 715700,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.taxableOrdinaryIncome).toBe(700000);
      // Verify some income is taxed at 37%
      const topBracket = result.ordinaryIncomeBracketBreakdown.find(b => b.rate === 0.37);
      expect(topBracket).toBeDefined();
      expect(topBracket!.incomeInBracket).toBe(700000 - 626350); // $73,650
    });

    it('handles zero taxable income correctly', () => {
      // Income exactly equals standard deduction
      const inputs = createDefaultInputs({
        federalIncome: 15700,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
    });
  });

  describe('FICA edge cases', () => {
    it('handles wages exactly at SS cap', () => {
      const inputs = createDefaultInputs({
        federalIncome: 168600,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.ficaBreakdown!.socialSecurityWages).toBe(168600);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(168600 * 0.062, 2);
      // No additional Medicare (under $200k threshold)
      expect(result.ficaBreakdown!.additionalMedicareTax).toBe(0);
    });

    it('applies lower Medicare threshold for MFS ($125k)', () => {
      // MFS threshold is $125,000 vs $200,000 for single
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        filingStatus: 'marriedFilingSeparately',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      // Additional Medicare on $25,000 ($150k - $125k)
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(25000 * 0.009, 2);
    });

    it('uses higher Medicare threshold for MFJ ($250k)', () => {
      const inputs = createDefaultInputs({
        federalIncome: 240000,
        filingStatus: 'marriedFilingJointly',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      // Under $250k threshold, no additional Medicare
      expect(result.ficaBreakdown!.additionalMedicareTax).toBe(0);
    });
  });

  describe('LTCG with 20% bracket', () => {
    it('applies 20% rate for very high LTCG', () => {
      // Single: 20% bracket starts at $518,900
      const inputs = createDefaultInputs({
        longTermCapitalGains: 600000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      // Verify some LTCG taxed at 20%
      const top20Bracket = result.ltcgBracketBreakdown.find(b => b.rate === 0.20);
      expect(top20Bracket).toBeDefined();
      expect(top20Bracket!.incomeInBracket).toBe(600000 - 518900);
    });
  });

  describe('refund and remaining owed calculations', () => {
    it('calculates refund when overpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        federalTaxWithheld: 10000,
        federalEstimatedPaid: 5000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.totalPaid).toBe(15000);
      // Tax should be less than $15k, so refund expected
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it('calculates remaining owed when underpaid', () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        federalTaxWithheld: 10000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      expect(result.totalPaid).toBe(10000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles zero income with capital gains only', () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 50000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.wageIncome).toBe(0);
      expect(result.grossIncome).toBe(50000);
      // LTCG should be taxed at 0% for first portion
      expect(result.ltcgTax).toBeGreaterThanOrEqual(0);
    });

    it('handles FICA with zero wages', () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 100000,
        filingStatus: 'single',
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits,
        ficaData
      );

      // FICA only applies to wages, not capital gains
      expect(result.ficaBreakdown?.totalFica).toBe(0);
    });

    it('handles all inputs at zero', () => {
      const inputs = createDefaultInputs();

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        limits
      );

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
    });
  });
});
