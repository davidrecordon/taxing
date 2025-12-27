import { describe, it, expect } from 'vitest';
import { calculateFederalDeductions, calculateCaliforniaDeductions } from '../deductionCalculator';
import { DeductionsData, LimitsData } from '../types';

// Load data from JSON files
import federalDeductions from '../../data/federal-deductions-2025.json';
import californiaDeductions from '../../data/california-deductions-2025.json';
import limits from '../../data/limits-2025.json';

interface DeductionInputs {
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  charitableContributions: number;
  californiaTaxWithheld: number;
  californiaEstimatedPaid: number;
}

function createDefaultDeductionInputs(overrides: Partial<DeductionInputs> = {}): DeductionInputs {
  return {
    propertyTaxesPaid: 0,
    mortgageInterestPaid: 0,
    mortgageBalance: 0,
    charitableContributions: 0,
    californiaTaxWithheld: 0,
    californiaEstimatedPaid: 0,
    ...overrides,
  };
}

describe('calculateFederalDeductions', () => {
  describe('SALT cap and standard vs itemized', () => {
    it('caps SALT at $10,000 and chooses itemized when higher than standard', () => {
      // $15,000 CA tax withheld + $8,000 property tax = $23,000 total SALT
      // Capped at $10,000
      // $20,000 mortgage interest + $5,000 charitable = $25,000
      // Total itemized: $10,000 + $25,000 = $35,000 > $15,000 standard
      const inputs = createDefaultDeductionInputs({
        californiaTaxWithheld: 15000,
        propertyTaxesPaid: 8000,
        mortgageInterestPaid: 20000,
        mortgageBalance: 500000, // within limit
        charitableContributions: 5000,
      });

      const result = calculateFederalDeductions(
        inputs,
        'single',
        federalDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.saltDeduction).toBe(10000);
      expect(result.saltCapped).toBe(true);
      expect(result.itemizedDeduction).toBe(35000);
      expect(result.deductionUsed).toBe('itemized');
      expect(result.deductionAmount).toBe(35000);
    });

    it('uses standard deduction when itemized is lower', () => {
      // Only $5,000 in itemizable deductions
      const inputs = createDefaultDeductionInputs({
        charitableContributions: 5000,
      });

      const result = calculateFederalDeductions(
        inputs,
        'single',
        federalDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.itemizedDeduction).toBe(5000);
      expect(result.deductionUsed).toBe('standard');
      expect(result.deductionAmount).toBe(15000);
    });
  });

  describe('mortgage interest proration', () => {
    it('prorates mortgage interest when balance exceeds limit', () => {
      // Mortgage balance $1,000,000 exceeds $750,000 limit
      // Interest paid: $30,000
      // Deductible: ($750,000 / $1,000,000) * $30,000 = $22,500
      const inputs = createDefaultDeductionInputs({
        mortgageInterestPaid: 30000,
        mortgageBalance: 1000000,
        charitableContributions: 10000, // need enough to exceed std deduction
      });

      const result = calculateFederalDeductions(
        inputs,
        'single',
        federalDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.mortgageInterest).toBe(22500);
      // Total itemized: $22,500 + $10,000 = $32,500 > $15,000 standard
      expect(result.deductionUsed).toBe('itemized');
    });

    it('allows full mortgage interest deduction when balance is within limit', () => {
      const inputs = createDefaultDeductionInputs({
        mortgageInterestPaid: 25000,
        mortgageBalance: 600000, // within $750,000 limit
        charitableContributions: 5000,
      });

      const result = calculateFederalDeductions(
        inputs,
        'single',
        federalDeductions as DeductionsData,
        limits as LimitsData
      );

      expect(result.mortgageInterest).toBe(25000);
    });

    it('assumes 100% deductible when no balance entered', () => {
      const inputs = createDefaultDeductionInputs({
        mortgageInterestPaid: 40000,
        mortgageBalance: 0, // no balance entered
        charitableContributions: 0,
      });

      const result = calculateFederalDeductions(
        inputs,
        'single',
        federalDeductions as DeductionsData,
        limits as LimitsData
      );

      // When itemized is chosen, mortgage interest should be full amount
      // $40,000 > $15,000 standard, so itemized is used
      expect(result.mortgageInterest).toBe(40000);
    });
  });
});

describe('calculateFederalDeductions MFS edge cases', () => {
  it('uses $5,000 SALT cap for MFS instead of $10,000', () => {
    const inputs = createDefaultDeductionInputs({
      californiaTaxWithheld: 8000,
      propertyTaxesPaid: 5000, // Total $13,000 SALT
      mortgageInterestPaid: 10000,
      mortgageBalance: 300000,
      charitableContributions: 5000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'marriedFilingSeparately',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    // SALT capped at $5,000 for MFS
    expect(result.saltDeduction).toBe(5000);
    expect(result.saltCapped).toBe(true);
  });

  it('uses $375,000 mortgage limit for MFS instead of $750,000', () => {
    // Balance $500k exceeds $375k MFS limit
    // Interest: $25,000
    // Deductible: ($375k / $500k) * $25k = $18,750
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 25000,
      mortgageBalance: 500000,
      charitableContributions: 5000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'marriedFilingSeparately',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.mortgageInterest).toBe(18750);
  });
});

describe('calculateFederalDeductions boundary cases', () => {
  it('SALT exactly at $10,000 limit is not marked as capped', () => {
    const inputs = createDefaultDeductionInputs({
      californiaTaxWithheld: 7000,
      propertyTaxesPaid: 3000, // Total exactly $10,000
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.saltDeduction).toBe(10000);
    expect(result.saltCapped).toBe(false);
  });

  it('itemized equals standard uses standard', () => {
    // Single std deduction is $15,000
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 15000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    // When equal, should use standard (itemized > standard is the condition)
    expect(result.itemizedDeduction).toBe(15000);
    expect(result.deductionUsed).toBe('standard');
  });

  it('itemized $1 more than standard uses itemized', () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 15001,
    });

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.deductionUsed).toBe('itemized');
    expect(result.deductionAmount).toBe(15001);
  });

  it('mortgage balance exactly at limit uses full interest', () => {
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 30000,
      mortgageBalance: 750000, // exactly at limit
      charitableContributions: 5000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.mortgageInterest).toBe(30000);
  });

  it('handles zero itemized deductions', () => {
    const inputs = createDefaultDeductionInputs({});

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.itemizedDeduction).toBe(0);
    expect(result.deductionUsed).toBe('standard');
    expect(result.deductionAmount).toBe(15000);
  });
});

describe('calculateFederalDeductions MFJ', () => {
  it('uses $30,000 standard deduction for MFJ', () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 25000, // less than $30k std
    });

    const result = calculateFederalDeductions(
      inputs,
      'marriedFilingJointly',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.standardDeduction).toBe(30000);
    expect(result.deductionUsed).toBe('standard');
    expect(result.deductionAmount).toBe(30000);
  });

  it('uses full $10,000 SALT cap for MFJ', () => {
    const inputs = createDefaultDeductionInputs({
      californiaTaxWithheld: 20000,
      propertyTaxesPaid: 15000,
      mortgageInterestPaid: 25000,
      mortgageBalance: 600000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'marriedFilingJointly',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.saltDeduction).toBe(10000);
    expect(result.saltCapped).toBe(true);
  });
});

describe('calculateFederalDeductions SALT components', () => {
  it('includes CA estimated payments in SALT', () => {
    const inputs = createDefaultDeductionInputs({
      californiaTaxWithheld: 5000,
      californiaEstimatedPaid: 3000,
      propertyTaxesPaid: 4000, // Total $12,000
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    // All three components counted, then capped
    expect(result.saltDeduction).toBe(10000);
    expect(result.saltCapped).toBe(true);
  });

  it('SALT with only property taxes', () => {
    const inputs = createDefaultDeductionInputs({
      propertyTaxesPaid: 8000,
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
    });

    const result = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.saltDeduction).toBe(8000);
    expect(result.saltCapped).toBe(false);
  });
});

describe('calculateCaliforniaDeductions', () => {
  it('does not include SALT in itemized deductions', () => {
    // Even with high state taxes, CA doesn't allow SALT deduction
    const inputs = createDefaultDeductionInputs({
      californiaTaxWithheld: 50000,
      propertyTaxesPaid: 20000,
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
      charitableContributions: 5000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    // Only mortgage interest + charitable = $15,000
    expect(result.saltDeduction).toBe(0);
    expect(result.itemizedDeduction).toBe(15000);
    // $15,000 > $5,540 standard, so itemized
    expect(result.deductionUsed).toBe('itemized');
  });

  it('uses $1M mortgage limit instead of federal $750k', () => {
    // Balance $900,000 is within CA limit but would exceed federal limit
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 45000,
      mortgageBalance: 900000,
      charitableContributions: 0,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    // Full interest is deductible since $900k < $1M CA limit
    expect(result.mortgageInterest).toBe(45000);
  });
});

describe('calculateCaliforniaDeductions edge cases', () => {
  it('prorates mortgage interest when balance exceeds $1M', () => {
    // Balance $1.5M exceeds $1M CA limit
    // Interest: $60,000
    // Deductible: ($1M / $1.5M) * $60k = $40,000
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 60000,
      mortgageBalance: 1500000,
      charitableContributions: 0,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.mortgageInterest).toBe(40000);
  });

  it('uses CA standard deduction of $5,540 for single', () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 3000, // less than $5,540
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.standardDeduction).toBe(5540);
    expect(result.deductionUsed).toBe('standard');
    expect(result.deductionAmount).toBe(5540);
  });

  it('uses CA standard deduction of $11,080 for MFJ', () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 8000, // less than $11,080
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'marriedFilingJointly',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.standardDeduction).toBe(11080);
    expect(result.deductionUsed).toBe('standard');
  });

  it('MFS uses same $1M mortgage limit as single/MFJ in CA', () => {
    // CA uses $1M limit for all filing statuses (unlike federal)
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 40000,
      mortgageBalance: 900000, // within $1M CA limit
      charitableContributions: 0,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'marriedFilingSeparately',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    // Full interest deductible
    expect(result.mortgageInterest).toBe(40000);
  });

  it('handles only charitable contributions in CA', () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 10000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    expect(result.itemizedDeduction).toBe(10000);
    expect(result.deductionUsed).toBe('itemized');
    expect(result.charitableContributions).toBe(10000);
  });

  it('ignores property taxes in CA itemized (no SALT)', () => {
    const inputs = createDefaultDeductionInputs({
      propertyTaxesPaid: 50000, // ignored
      charitableContributions: 3000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    // Only charitable counts
    expect(result.itemizedDeduction).toBe(3000);
    expect(result.saltDeduction).toBe(0);
    // $3k < $5,540 std, use standard
    expect(result.deductionUsed).toBe('standard');
  });
});

describe('mortgage interest edge cases across both jurisdictions', () => {
  it('same balance treated differently between federal and CA', () => {
    // $800k balance: within CA $1M limit but over federal $750k limit
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 40000,
      mortgageBalance: 800000,
      charitableContributions: 5000,
    });

    const federalResult = calculateFederalDeductions(
      inputs,
      'single',
      federalDeductions as DeductionsData,
      limits as LimitsData
    );

    const caResult = calculateCaliforniaDeductions(
      inputs,
      'single',
      californiaDeductions as DeductionsData,
      limits as LimitsData
    );

    // Federal: ($750k / $800k) * $40k = $37,500
    expect(federalResult.mortgageInterest).toBe(37500);
    // CA: Full $40k (within $1M limit)
    expect(caResult.mortgageInterest).toBe(40000);
  });
});
