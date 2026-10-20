import { describe, it, expect } from "vitest";
import {
  calculateCaliforniaDeductions,
  calculateFederalDeductions,
  calculateSaltLimit,
} from "../deductionCalculator";
import { DeductionsData, FederalLimitsData } from "../types";
import {
  federalDeductions,
  californiaDeductions,
  federalLimits,
  californiaLimits,
  loadTestDataForYear,
} from "./testData";

interface DeductionInputs {
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  charitableContributions: number;
  stateTaxWithheld: number;
  stateEstimatedPaid: number;
}

function createDefaultDeductionInputs(
  overrides: Partial<DeductionInputs> = {},
): DeductionInputs {
  return {
    propertyTaxesPaid: 0,
    mortgageInterestPaid: 0,
    mortgageBalance: 0,
    charitableContributions: 0,
    stateTaxWithheld: 0,
    stateEstimatedPaid: 0,
    ...overrides,
  };
}

// AGI high enough that the SALT cap is fully phased down to its floor
const HIGH_AGI = 700000;
// AGI below the phasedown threshold, so the full SALT cap applies
const LOW_AGI = 400000;
// AGI below the California high-income itemized deduction limitation
const CA_LOW_AGI = 100000;

describe("calculateFederalDeductions", () => {
  describe("SALT cap and standard vs itemized", () => {
    it("caps SALT at $10,000 when fully phased down and chooses itemized when higher than standard", () => {
      // $15,000 CA tax withheld + $8,000 property tax = $23,000 total SALT
      // Capped at $10,000 (fully phased down)
      // $20,000 mortgage interest + $5,000 charitable = $25,000
      // Total itemized: $10,000 + $25,000 = $35,000 > $15,000 standard
      const inputs = createDefaultDeductionInputs({
        stateTaxWithheld: 15000,
        propertyTaxesPaid: 8000,
        mortgageInterestPaid: 20000,
        mortgageBalance: 500000, // within limit
        charitableContributions: 5000,
      });

      const result = calculateFederalDeductions(
        inputs,
        "single",
        federalDeductions as DeductionsData,
        federalLimits as FederalLimitsData,
        HIGH_AGI,
      );

      expect(result.saltDeduction).toBe(10000);
      expect(result.saltCapped).toBe(true);
      expect(result.itemizedDeduction).toBe(35000);
      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(35000);
    });

    it("uses standard deduction when itemized is lower", () => {
      // Only $5,000 in itemizable deductions
      const inputs = createDefaultDeductionInputs({
        charitableContributions: 5000,
      });

      const result = calculateFederalDeductions(
        inputs,
        "single",
        federalDeductions as DeductionsData,
        federalLimits as FederalLimitsData,
        HIGH_AGI,
      );

      expect(result.itemizedDeduction).toBe(5000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(16100);
    });
  });

  describe("mortgage interest proration", () => {
    it("prorates mortgage interest when balance exceeds limit", () => {
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
        "single",
        federalDeductions as DeductionsData,
        federalLimits as FederalLimitsData,
        HIGH_AGI,
      );

      expect(result.mortgageInterest).toBe(22500);
      // Total itemized: $22,500 + $10,000 = $32,500 > $15,000 standard
      expect(result.deductionUsed).toBe("itemized");
    });

    it("allows full mortgage interest deduction when balance is within limit", () => {
      const inputs = createDefaultDeductionInputs({
        mortgageInterestPaid: 25000,
        mortgageBalance: 600000, // within $750,000 limit
        charitableContributions: 5000,
      });

      const result = calculateFederalDeductions(
        inputs,
        "single",
        federalDeductions as DeductionsData,
        federalLimits as FederalLimitsData,
        HIGH_AGI,
      );

      expect(result.mortgageInterest).toBe(25000);
    });

    it("assumes 100% deductible when no balance entered", () => {
      const inputs = createDefaultDeductionInputs({
        mortgageInterestPaid: 40000,
        mortgageBalance: 0, // no balance entered
        charitableContributions: 0,
      });

      const result = calculateFederalDeductions(
        inputs,
        "single",
        federalDeductions as DeductionsData,
        federalLimits as FederalLimitsData,
        HIGH_AGI,
      );

      // When itemized is chosen, mortgage interest should be full amount
      // $40,000 > $15,000 standard, so itemized is used
      expect(result.mortgageInterest).toBe(40000);
    });
  });
});

describe("calculateFederalDeductions MFS edge cases", () => {
  it("uses $5,000 SALT cap for MFS when fully phased down", () => {
    const inputs = createDefaultDeductionInputs({
      stateTaxWithheld: 8000,
      propertyTaxesPaid: 5000, // Total $13,000 SALT
      mortgageInterestPaid: 10000,
      mortgageBalance: 300000,
      charitableContributions: 5000,
    });

    const result = calculateFederalDeductions(
      inputs,
      "marriedFilingSeparately",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    // SALT capped at $5,000 for MFS when fully phased down
    expect(result.saltDeduction).toBe(5000);
    expect(result.saltCapped).toBe(true);
  });

  it("uses $375,000 mortgage limit for MFS instead of $750,000", () => {
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
      "marriedFilingSeparately",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.mortgageInterest).toBe(18750);
  });
});

describe("calculateFederalDeductions boundary cases", () => {
  it("SALT exactly at $10,000 limit is not marked as capped (high AGI)", () => {
    const inputs = createDefaultDeductionInputs({
      stateTaxWithheld: 7000,
      propertyTaxesPaid: 3000, // Total exactly $10,000
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
    });

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.saltDeduction).toBe(10000);
    expect(result.saltCapped).toBe(false);
  });

  it("itemized equals standard uses standard", () => {
    // Single std deduction is $16,100
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 16100,
    });

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    // When equal, should use standard (itemized > standard is the condition)
    expect(result.itemizedDeduction).toBe(16100);
    expect(result.deductionUsed).toBe("standard");
  });

  it("itemized $1 more than standard uses itemized", () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 16101,
    });

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.deductionUsed).toBe("itemized");
    expect(result.deductionAmount).toBe(16101);
  });

  it("mortgage balance exactly at limit uses full interest", () => {
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 30000,
      mortgageBalance: 750000, // exactly at limit
      charitableContributions: 5000,
    });

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.mortgageInterest).toBe(30000);
  });

  it("handles zero itemized deductions", () => {
    const inputs = createDefaultDeductionInputs({});

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.itemizedDeduction).toBe(0);
    expect(result.deductionUsed).toBe("standard");
    expect(result.deductionAmount).toBe(16100);
  });
});

describe("calculateFederalDeductions MFJ", () => {
  it("uses $32,200 standard deduction for MFJ", () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 25000, // less than $32.2k std
    });

    const result = calculateFederalDeductions(
      inputs,
      "marriedFilingJointly",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.standardDeduction).toBe(32200);
    expect(result.deductionUsed).toBe("standard");
    expect(result.deductionAmount).toBe(32200);
  });

  it("uses $10,000 SALT cap for MFJ when fully phased down", () => {
    const inputs = createDefaultDeductionInputs({
      stateTaxWithheld: 20000,
      propertyTaxesPaid: 15000,
      mortgageInterestPaid: 25000,
      mortgageBalance: 600000,
    });

    const result = calculateFederalDeductions(
      inputs,
      "marriedFilingJointly",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.saltDeduction).toBe(10000);
    expect(result.saltCapped).toBe(true);
  });
});

describe("calculateFederalDeductions SALT components", () => {
  it("includes CA estimated payments in SALT", () => {
    const inputs = createDefaultDeductionInputs({
      stateTaxWithheld: 5000,
      stateEstimatedPaid: 3000,
      propertyTaxesPaid: 4000, // Total $12,000
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
    });

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    // All three components counted, then capped at $10k (high AGI)
    expect(result.saltDeduction).toBe(10000);
    expect(result.saltCapped).toBe(true);
  });

  it("SALT with only property taxes", () => {
    const inputs = createDefaultDeductionInputs({
      propertyTaxesPaid: 8000,
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
    });

    const result = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    expect(result.saltDeduction).toBe(8000);
    expect(result.saltCapped).toBe(false);
  });
});

describe("calculateCaliforniaDeductions", () => {
  it("deducts property tax but not state income tax", () => {
    // CA allows property tax in full (no cap) but not state income tax
    const inputs = createDefaultDeductionInputs({
      stateTaxWithheld: 50000,
      propertyTaxesPaid: 20000,
      mortgageInterestPaid: 10000,
      mortgageBalance: 500000,
      charitableContributions: 5000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    // Property tax + mortgage interest + charitable = $35,000
    expect(result.saltDeduction).toBe(0);
    expect(result.propertyTax).toBe(20000);
    expect(result.itemizedDeduction).toBe(35000);
    // $35,000 > $5,900 standard, so itemized
    expect(result.deductionUsed).toBe("itemized");
  });

  it("uses $1M mortgage limit instead of federal $750k", () => {
    // Balance $900,000 is within CA limit but would exceed federal limit
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 45000,
      mortgageBalance: 900000,
      charitableContributions: 0,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    // Full interest is deductible since $900k < $1M CA limit
    expect(result.mortgageInterest).toBe(45000);
  });
});

describe("calculateCaliforniaDeductions edge cases", () => {
  it("prorates mortgage interest when balance exceeds $1M", () => {
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
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    expect(result.mortgageInterest).toBe(40000);
  });

  it("uses CA standard deduction of $5,900 for single", () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 3000, // less than $5,900
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    expect(result.standardDeduction).toBe(5900);
    expect(result.deductionUsed).toBe("standard");
    expect(result.deductionAmount).toBe(5900);
  });

  it("uses CA standard deduction of $11,800 for MFJ", () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 8000, // less than $11,800
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "marriedFilingJointly",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    expect(result.standardDeduction).toBe(11800);
    expect(result.deductionUsed).toBe("standard");
  });

  it("MFS uses a $500k mortgage limit in CA", () => {
    // CA uses $1M ($500k married filing separately)
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 45000,
      mortgageBalance: 900000, // over the $500k MFS limit
      charitableContributions: 0,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "marriedFilingSeparately",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    // ($500k / $900k) * $45k = $25,000
    expect(result.mortgageInterest).toBeCloseTo(25000, 2);
  });

  it("handles only charitable contributions in CA", () => {
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 10000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    expect(result.itemizedDeduction).toBe(10000);
    expect(result.deductionUsed).toBe("itemized");
    expect(result.charitableContributions).toBe(10000);
  });

  it("deducts property tax without a cap", () => {
    const inputs = createDefaultDeductionInputs({
      propertyTaxesPaid: 50000, // above the federal cap, still allowed in full
      charitableContributions: 3000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    expect(result.itemizedDeduction).toBe(53000);
    expect(result.propertyTax).toBe(50000);
    expect(result.saltDeduction).toBe(0);
    expect(result.deductionUsed).toBe("itemized");
  });
});

describe("calculateCaliforniaDeductions high-income limitation", () => {
  it("does not reduce deductions at or below the threshold", () => {
    const inputs = createDefaultDeductionInputs({
      propertyTaxesPaid: 12000,
      mortgageInterestPaid: 20000,
      mortgageBalance: 600000,
      charitableContributions: 3000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      252203,
    );

    expect(result.highIncomeReduction).toBe(0);
    expect(result.itemizedDeduction).toBe(35000);
  });

  it("reduces deductions by 6% of AGI over the threshold", () => {
    // Single, AGI $600,000: 6% x ($600,000 - $252,203) = $20,867.82
    // 80% x $50,000 = $40,000, so the 6% amount applies
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 30000,
      mortgageBalance: 900000,
      charitableContributions: 20000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      600000,
    );

    expect(result.highIncomeReduction).toBeCloseTo(20867.82, 2);
    expect(result.itemizedDeduction).toBeCloseTo(29132.18, 2);
  });

  it("limits the reduction to 80% of itemized deductions", () => {
    // MFJ, AGI $3,000,000: 6% x ($3,000,000 - $504,411) = $149,735.34
    // 80% x $100,000 = $80,000, so the 80% amount applies
    const inputs = createDefaultDeductionInputs({
      propertyTaxesPaid: 30000,
      mortgageInterestPaid: 40000,
      mortgageBalance: 900000,
      charitableContributions: 30000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "marriedFilingJointly",
      californiaDeductions,
      californiaLimits,
      3000000,
    );

    expect(result.highIncomeReduction).toBe(80000);
    expect(result.itemizedDeduction).toBe(20000);
    expect(result.deductionUsed).toBe("itemized");
  });

  it("compares the reduced amount with the standard deduction", () => {
    // $12,000 of deductions reduced by 80% leaves $2,400, below the standard
    const inputs = createDefaultDeductionInputs({
      charitableContributions: 12000,
    });

    const result = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      2000000,
    );

    expect(result.itemizedDeduction).toBeCloseTo(2400, 2);
    expect(result.deductionUsed).toBe("standard");
  });
});

describe("mortgage interest edge cases across both jurisdictions", () => {
  it("same balance treated differently between federal and CA", () => {
    // $800k balance: within CA $1M limit but over federal $750k limit
    const inputs = createDefaultDeductionInputs({
      mortgageInterestPaid: 40000,
      mortgageBalance: 800000,
      charitableContributions: 5000,
    });

    const federalResult = calculateFederalDeductions(
      inputs,
      "single",
      federalDeductions,
      federalLimits,
      HIGH_AGI,
    );

    const caResult = calculateCaliforniaDeductions(
      inputs,
      "single",
      californiaDeductions,
      californiaLimits,
      CA_LOW_AGI,
    );

    // Federal: ($750k / $800k) * $40k = $37,500
    expect(federalResult.mortgageInterest).toBe(37500);
    // CA: Full $40k (within $1M limit)
    expect(caResult.mortgageInterest).toBe(40000);
  });
});

describe("calculateFederalDeductions AGI-dependent SALT cap", () => {
  // $50,000 of state and local taxes, well above every cap
  const highSaltInputs = createDefaultDeductionInputs({
    stateTaxWithheld: 30000,
    propertyTaxesPaid: 20000,
    mortgageInterestPaid: 20000,
    mortgageBalance: 500000,
  });

  const saltDeductionAt = (
    filingStatus: Parameters<typeof calculateFederalDeductions>[1],
    agi: number,
  ) =>
    calculateFederalDeductions(
      highSaltInputs,
      filingStatus,
      federalDeductions,
      federalLimits,
      agi,
    );

  describe("full SALT cap below the phasedown threshold", () => {
    it("uses $40,400 SALT cap for Single", () => {
      const result = saltDeductionAt("single", LOW_AGI);

      expect(result.saltDeduction).toBe(40400);
      expect(result.saltCapped).toBe(true);
    });

    it("uses the same $40,400 SALT cap for MFJ", () => {
      const result = saltDeductionAt("marriedFilingJointly", LOW_AGI);

      expect(result.saltDeduction).toBe(40400);
      expect(result.saltCapped).toBe(true);
    });

    it("uses half the cap ($20,200) for MFS", () => {
      // MFS threshold is $252,500, so use an AGI below it
      const result = saltDeductionAt("marriedFilingSeparately", 200000);

      expect(result.saltDeduction).toBe(20200);
      expect(result.saltCapped).toBe(true);
    });

    it("does not cap SALT below the limit", () => {
      const inputs = createDefaultDeductionInputs({
        stateTaxWithheld: 10000,
        propertyTaxesPaid: 5000, // Total $15,000 SALT (below $40,400 limit)
        mortgageInterestPaid: 10000,
        mortgageBalance: 500000,
      });

      const result = calculateFederalDeductions(
        inputs,
        "single",
        federalDeductions,
        federalLimits,
        LOW_AGI,
      );

      expect(result.saltDeduction).toBe(15000);
      expect(result.saltCapped).toBe(false);
    });
  });

  describe("phasedown above the threshold", () => {
    it("uses the full cap when AGI is exactly $505,000", () => {
      expect(saltDeductionAt("single", 505000).saltDeduction).toBe(40400);
    });

    it("reduces the cap by 30% of AGI over the threshold", () => {
      // $520,000 - $505,000 = $15,000 over, x 30% = $4,500 reduction
      expect(saltDeductionAt("single", 520000).saltDeduction).toBe(35900);
    });

    it("does not reduce the cap below the $10,000 floor", () => {
      // $650,000 - $505,000 = $145,000 over, x 30% = $43,500 reduction
      expect(saltDeductionAt("single", 650000).saltDeduction).toBe(10000);
    });

    it("starts the MFS phasedown at half the threshold and halves the result", () => {
      // $262,500 - $252,500 = $10,000 over, x 30% = $3,000 reduction
      // ($40,400 - $3,000) / 2 = $18,700
      expect(
        saltDeductionAt("marriedFilingSeparately", 262500).saltDeduction,
      ).toBe(18700);
    });
  });

  describe("calculateSaltLimit by tax year", () => {
    it("uses $40,000 and a $500,000 threshold for 2025", () => {
      const limits2025 = loadTestDataForYear("2025").federalLimits;

      expect(calculateSaltLimit("single", limits2025, 400000)).toBe(40000);
      // $515,000 - $500,000 = $15,000 over, x 30% = $4,500 reduction
      expect(calculateSaltLimit("single", limits2025, 515000)).toBe(35500);
      expect(
        calculateSaltLimit("marriedFilingSeparately", limits2025, 200000),
      ).toBe(20000);
      // MFS: ($40,000 - 30% x $50,000 over $250,000) / 2
      expect(
        calculateSaltLimit("marriedFilingSeparately", limits2025, 300000),
      ).toBe(12500);
      // MFS reaches the $5,000 floor at $350,000
      expect(
        calculateSaltLimit("marriedFilingSeparately", limits2025, 350000),
      ).toBe(5000);
      expect(
        calculateSaltLimit("marriedFilingSeparately", limits2025, 700000),
      ).toBe(5000);
    });

    it("uses $40,400 and a $505,000 threshold for 2026", () => {
      const limits2026 = loadTestDataForYear("2026").federalLimits;

      expect(calculateSaltLimit("single", limits2026, 400000)).toBe(40400);
      expect(calculateSaltLimit("single", limits2026, 515000)).toBe(37400);
      expect(
        calculateSaltLimit("marriedFilingSeparately", limits2026, 200000),
      ).toBe(20200);
    });
  });
});
