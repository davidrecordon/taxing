import { describe, it, expect } from "vitest";
import {
  applyFederalItemizedLimit,
  calculateCaliforniaDeductions,
  calculateCharitableFloor,
  calculateDCDeductions,
  calculateFederalDeductions,
  calculateNewYorkDeductions,
  calculateSaltLimit,
} from "../deductionCalculator";
import { DeductionBreakdown, DeductionChoice, FilingStatus } from "../types";
import {
  californiaDeductions,
  californiaLimits,
  dcDeductions,
  dcLimits,
  federalDeductions,
  federalLimits,
  loadTestDataForYear,
  newYorkDeductions,
  newYorkLimits,
} from "./testData";

interface DeductionInputs {
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  isMortgageGrandfathered?: boolean;
  charitableContributions: number;
  stateTaxWithheld: number;
  stateEstimatedPaid: number;
  priorYearStateBalancePaid?: number;
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

// A federal breakdown as calculateFederalDeductions would return it, for the
// functions that take one as input
function createFederalBreakdown(
  overrides: Partial<DeductionBreakdown> = {},
): DeductionBreakdown {
  return {
    standardDeduction: 16100,
    itemizedDeduction: 0,
    deductionUsed: "standard",
    deductionAmount: 16100,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
    ...overrides,
  };
}

describe("Federal deductions", () => {
  // AGI below the $505,000 SALT phase-down threshold ($252,500 married filing
  // separately), so the full SALT cap applies
  const AGI = 200000;

  const federal = (
    overrides: Partial<DeductionInputs>,
    filingStatus: FilingStatus = "single",
    agi: number = AGI,
    deductionChoice?: DeductionChoice,
  ) =>
    calculateFederalDeductions(
      createDefaultDeductionInputs(overrides),
      filingStatus,
      federalDeductions,
      federalLimits,
      agi,
      deductionChoice,
    );

  describe("standard versus itemized", () => {
    it.each([
      ["single", 16100],
      ["marriedFilingJointly", 32200],
      ["marriedFilingSeparately", 16100],
    ] as const)(
      "gives %s a standard deduction of $%i",
      (filingStatus, standardDeduction) => {
        const result = federal({}, filingStatus);

        expect(result.standardDeduction).toBe(standardDeduction);
        expect(result.itemizedDeduction).toBe(0);
        expect(result.deductionUsed).toBe("standard");
        expect(result.deductionAmount).toBe(standardDeduction);
      },
    );

    it("itemizes when the total is more than the $16,100 standard deduction", () => {
      // Single, AGI $200,000
      // State and local taxes: $12,000 withheld + $8,000 property tax = $20,000
      //   (under the $40,400 cap)
      // Mortgage interest: $15,000 (no balance entered)
      // Charitable: $5,000 - 0.5% x $200,000 = $5,000 - $1,000 = $4,000
      // Itemized: $20,000 + $15,000 + $4,000 = $39,000
      const result = federal({
        stateTaxWithheld: 12000,
        propertyTaxesPaid: 8000,
        mortgageInterestPaid: 15000,
        charitableContributions: 5000,
      });

      expect(result.saltDeduction).toBe(20000);
      expect(result.saltCapped).toBe(false);
      expect(result.mortgageInterest).toBe(15000);
      expect(result.charitableContributions).toBe(4000);
      expect(result.charitableFloorReduction).toBe(1000);
      expect(result.itemizedDeduction).toBe(39000);
      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(39000);
    });

    it("takes the standard deduction when itemized deductions equal it at $16,100", () => {
      const result = federal({ mortgageInterestPaid: 16100 });

      expect(result.itemizedDeduction).toBe(16100);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(16100);
    });

    it("itemizes at $16,101, one dollar more than the standard deduction", () => {
      const result = federal({ mortgageInterestPaid: 16101 });

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(16101);
    });

    it("reports no itemized components when the standard deduction is used", () => {
      // AGI $700,000, where the SALT cap is at its $10,000 floor
      // SALT: $12,000 capped at $10,000
      // Charitable: $4,000 - 0.5% x $700,000 = $4,000 - $3,500 = $500
      // Itemized: $10,000 + $500 = $10,500, below the $16,100 standard
      const result = federal(
        { stateTaxWithheld: 12000, charitableContributions: 4000 },
        "single",
        700000,
      );

      expect(result.itemizedDeduction).toBe(10500);
      expect(result.deductionUsed).toBe("standard");
      expect(result.saltDeduction).toBe(0);
      expect(result.saltCapped).toBe(false);
      expect(result.mortgageInterest).toBe(0);
      expect(result.charitableContributions).toBe(0);
      expect(result.charitableFloorReduction).toBe(0);
    });

    it("itemizes $5,000 when the choice is itemized, though the standard deduction is larger", () => {
      const result = federal(
        { mortgageInterestPaid: 5000 },
        "single",
        AGI,
        "itemized",
      );

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(5000);
      expect(result.mortgageInterest).toBe(5000);
    });

    it("takes the $16,100 standard deduction when the choice is standard, though $30,000 could be itemized", () => {
      const result = federal(
        { mortgageInterestPaid: 30000 },
        "single",
        AGI,
        "standard",
      );

      expect(result.itemizedDeduction).toBe(30000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(16100);
      expect(result.mortgageInterest).toBe(0);
    });
  });

  describe("state and local taxes (SALT)", () => {
    // The choice is set to itemized so that the SALT amount is reported
    // whatever the standard deduction is
    const salt = (
      overrides: Partial<DeductionInputs>,
      filingStatus: FilingStatus = "single",
      agi: number = AGI,
    ) => federal(overrides, filingStatus, agi, "itemized");

    describe("what counts", () => {
      it.each([
        ["state tax withheld", "stateTaxWithheld"],
        ["state estimated payments", "stateEstimatedPaid"],
        ["a balance paid this year for last year's state tax", "priorYearStateBalancePaid"],
        ["property tax", "propertyTaxesPaid"],
      ] as const)("counts %s", (_label, field) => {
        expect(salt({ [field]: 6000 }).saltDeduction).toBe(6000);
      });

      it("adds the four together", () => {
        // $5,000 + $3,000 + $2,000 + $4,000 = $14,000
        const result = salt({
          stateTaxWithheld: 5000,
          stateEstimatedPaid: 3000,
          priorYearStateBalancePaid: 2000,
          propertyTaxesPaid: 4000,
        });

        expect(result.saltDeduction).toBe(14000);
        expect(result.saltCapped).toBe(false);
      });
    });

    describe("the cap", () => {
      it.each([
        ["single", 40400],
        ["marriedFilingJointly", 40400],
        ["marriedFilingSeparately", 20200],
      ] as const)("caps %s at $%i", (filingStatus, cap) => {
        // $50,000 of state tax, more than either cap
        const result = salt({ stateTaxWithheld: 50000 }, filingStatus);

        expect(result.saltDeduction).toBe(cap);
        expect(result.saltCapped).toBe(true);
      });

      it("allows exactly $40,400 in full and does not mark it as capped", () => {
        const result = salt({ stateTaxWithheld: 40400 });

        expect(result.saltDeduction).toBe(40400);
        expect(result.saltCapped).toBe(false);
      });

      it("caps $40,401 at $40,400", () => {
        const result = salt({ stateTaxWithheld: 40401 });

        expect(result.saltDeduction).toBe(40400);
        expect(result.saltCapped).toBe(true);
      });
    });

    describe("the phase-down above $505,000 of AGI", () => {
      it("leaves the cap at $40,400 when AGI is exactly $505,000", () => {
        expect(calculateSaltLimit("single", federalLimits, 505000)).toBe(40400);
      });

      it("starts reducing the cap at $505,001", () => {
        // $1 over x 30% = $0.30; $40,400 - $0.30 = $40,399.70
        expect(
          calculateSaltLimit("single", federalLimits, 505001),
        ).toBeCloseTo(40399.7, 2);
      });

      it("reduces the cap by 30% of AGI over $505,000", () => {
        // $520,000 - $505,000 = $15,000 over, x 30% = $4,500
        // $40,400 - $4,500 = $35,900
        expect(calculateSaltLimit("single", federalLimits, 520000)).toBe(35900);
      });

      it("uses the same threshold for married filing jointly", () => {
        expect(
          calculateSaltLimit("marriedFilingJointly", federalLimits, 520000),
        ).toBe(35900);
      });

      it("is still ten cents above the $10,000 floor at $606,333", () => {
        // $101,333 over x 30% = $30,399.90; $40,400 - $30,399.90 = $10,000.10
        expect(
          calculateSaltLimit("single", federalLimits, 606333),
        ).toBeCloseTo(10000.1, 2);
      });

      it("stops at the $10,000 floor from $606,334", () => {
        // $101,334 over x 30% = $30,400.20, which would leave $9,999.80
        expect(calculateSaltLimit("single", federalLimits, 606334)).toBe(10000);
        expect(calculateSaltLimit("single", federalLimits, 5000000)).toBe(
          10000,
        );
      });

      it("applies the reduced cap to the deduction", () => {
        // Cap at $520,000 of AGI is $35,900 (above)
        const result = salt({ stateTaxWithheld: 50000 }, "single", 520000);

        expect(result.saltDeduction).toBe(35900);
        expect(result.saltCapped).toBe(true);
      });
    });

    describe("married filing separately", () => {
      const separateLimit = (agi: number) =>
        calculateSaltLimit("marriedFilingSeparately", federalLimits, agi);

      it("leaves the cap at $20,200 when AGI is exactly $252,500", () => {
        expect(separateLimit(252500)).toBe(20200);
      });

      it("starts reducing the cap at $252,501", () => {
        // ($40,400 - 30% x $1) / 2 = $40,399.70 / 2 = $20,199.85
        expect(separateLimit(252501)).toBeCloseTo(20199.85, 2);
      });

      it("reduces the full cap by 30% of AGI over $252,500, then halves it", () => {
        // $262,500 - $252,500 = $10,000 over, x 30% = $3,000
        // ($40,400 - $3,000) / 2 = $18,700
        expect(separateLimit(262500)).toBe(18700);
      });

      it("stops at a $5,000 floor from $353,834", () => {
        // $101,334 over x 30% = $30,400.20, so the full cap is at its
        // $10,000 floor; half is $5,000
        expect(separateLimit(353834)).toBe(5000);
        expect(separateLimit(5000000)).toBe(5000);
      });
    });

    describe("by tax year", () => {
      const limits2025 = loadTestDataForYear("2025").federalLimits;

      it("caps SALT at $40,000 ($20,000 married filing separately) in 2025", () => {
        expect(calculateSaltLimit("single", limits2025, 200000)).toBe(40000);
        expect(
          calculateSaltLimit("marriedFilingSeparately", limits2025, 200000),
        ).toBe(20000);
      });

      it("phases down above $500,000 ($250,000 married filing separately) in 2025", () => {
        expect(calculateSaltLimit("single", limits2025, 500000)).toBe(40000);
        // $515,000 - $500,000 = $15,000 over, x 30% = $4,500
        expect(calculateSaltLimit("single", limits2025, 515000)).toBe(35500);
        // ($40,000 - 30% x ($300,000 - $250,000)) / 2 = $25,000 / 2
        expect(
          calculateSaltLimit("marriedFilingSeparately", limits2025, 300000),
        ).toBe(12500);
      });
    });
  });

  // The proportion rule is shared with California, New York and DC, whose
  // sections only test the limits they pass to it
  describe("mortgage interest", () => {
    // $40,000 of interest, so every case below itemizes
    const mortgageInterest = (
      mortgageBalance: number,
      filingStatus: FilingStatus = "single",
      isMortgageGrandfathered = false,
    ) =>
      federal(
        { mortgageInterestPaid: 40000, mortgageBalance, isMortgageGrandfathered },
        filingStatus,
      ).mortgageInterest;

    it("deducts all the interest when no balance is entered", () => {
      expect(mortgageInterest(0)).toBe(40000);
    });

    it("deducts all the interest on a balance of exactly $750,000", () => {
      expect(mortgageInterest(750000)).toBe(40000);
    });

    it("starts prorating at a balance of $750,001", () => {
      // $750,000 / $750,001 x $40,000 = $40,000 - $0.05 = $39,999.95
      expect(mortgageInterest(750001)).toBeCloseTo(39999.95, 2);
    });

    it("deducts the share of interest on the first $750,000 of a larger balance", () => {
      // $750,000 / $1,000,000 x $40,000 = $30,000
      expect(mortgageInterest(1000000)).toBe(30000);
    });

    it("deducts all the interest on exactly $375,000 when married filing separately", () => {
      expect(mortgageInterest(375000, "marriedFilingSeparately")).toBe(40000);
    });

    it("limits married filing separately to the first $375,000", () => {
      // $375,000 / $500,000 x $40,000 = $30,000
      expect(mortgageInterest(500000, "marriedFilingSeparately")).toBe(30000);
    });

    describe("loans from before December 16, 2017", () => {
      it("deducts all the interest on a balance of exactly $1,000,000", () => {
        expect(mortgageInterest(1000000, "single", true)).toBe(40000);
      });

      it("deducts the share of interest on the first $1,000,000", () => {
        // $1,000,000 / $1,250,000 x $40,000 = $32,000
        expect(mortgageInterest(1250000, "single", true)).toBe(32000);
      });

      it("deducts all the interest on exactly $500,000 when married filing separately", () => {
        expect(mortgageInterest(500000, "marriedFilingSeparately", true)).toBe(
          40000,
        );
      });

      it("limits married filing separately to the first $500,000", () => {
        // $500,000 / $800,000 x $40,000 = $25,000
        expect(mortgageInterest(800000, "marriedFilingSeparately", true)).toBe(
          25000,
        );
      });
    });
  });

  describe("charitable floor", () => {
    it("is 0.5% of AGI", () => {
      // 0.5% x $200,000 = $1,000
      expect(calculateCharitableFloor(200000, federalLimits)).toBe(1000);
    });

    it("is zero when AGI is negative", () => {
      expect(calculateCharitableFloor(-50000, federalLimits)).toBe(0);
    });

    it("is zero in 2025", () => {
      expect(
        calculateCharitableFloor(
          200000,
          loadTestDataForYear("2025").federalLimits,
        ),
      ).toBe(0);
    });

    // Each case has $20,000 of mortgage interest so that it itemizes
    it("deducts only giving above the floor", () => {
      // AGI $200,000: floor $1,000, so $2,000 of the $3,000 counts
      // Itemized: $20,000 + $2,000 = $22,000
      const result = federal({
        mortgageInterestPaid: 20000,
        charitableContributions: 3000,
      });

      expect(result.charitableFloorReduction).toBe(1000);
      expect(result.charitableContributions).toBe(2000);
      expect(result.itemizedDeduction).toBe(22000);
    });

    it("deducts nothing when giving equals the $1,000 floor", () => {
      const result = federal({
        mortgageInterestPaid: 20000,
        charitableContributions: 1000,
      });

      expect(result.charitableFloorReduction).toBe(1000);
      expect(result.charitableContributions).toBe(0);
    });

    it("deducts $1 when giving is one dollar over the floor", () => {
      const result = federal({
        mortgageInterestPaid: 20000,
        charitableContributions: 1001,
      });

      expect(result.charitableContributions).toBe(1);
    });

    it("loses only what was given when giving is under the floor", () => {
      // $800 given against a $1,000 floor: $800 lost, nothing negative
      const result = federal({
        mortgageInterestPaid: 20000,
        charitableContributions: 800,
      });

      expect(result.charitableFloorReduction).toBe(800);
      expect(result.charitableContributions).toBe(0);
      expect(result.itemizedDeduction).toBe(20000);
    });

    it("deducts giving in full in 2025", () => {
      const data2025 = loadTestDataForYear("2025");
      const result = calculateFederalDeductions(
        createDefaultDeductionInputs({
          mortgageInterestPaid: 20000,
          charitableContributions: 3000,
        }),
        "single",
        data2025.federalDeductions,
        data2025.federalLimits,
        AGI,
      );

      expect(result.charitableFloorReduction).toBe(0);
      expect(result.charitableContributions).toBe(3000);
      expect(result.itemizedDeduction).toBe(23000);
    });
  });

  describe("overall limit on itemized deductions", () => {
    // Married filing jointly: $32,200 standard deduction, and the top
    // bracket starts at $768,700
    const TOP_BRACKET_START = 768700;

    const itemized = (itemizedDeduction: number): DeductionBreakdown =>
      createFederalBreakdown({
        standardDeduction: 32200,
        itemizedDeduction,
        deductionUsed: "itemized",
        deductionAmount: itemizedDeduction,
        saltDeduction: 10000,
        saltCapped: true,
        mortgageInterest: itemizedDeduction - 10000,
      });

    it("removes 2/37 of the deductions when they are less than income over the top bracket", () => {
      // $1,000,000 - $768,700 = $231,300 over; the deductions, $74,000, are less
      // $74,000 x 2 / 37 = $4,000; $74,000 - $4,000 = $70,000
      const result = applyFederalItemizedLimit(
        itemized(74000),
        1000000,
        TOP_BRACKET_START,
        federalLimits,
      );

      expect(result.highIncomeReduction).toBe(4000);
      expect(result.itemizedDeduction).toBe(70000);
      expect(result.deductionAmount).toBe(70000);
      expect(result.deductionUsed).toBe("itemized");
    });

    it("removes 2/37 of income over the top bracket when that is less than the deductions", () => {
      // $805,700 - $768,700 = $37,000 over, less than the $74,000 of deductions
      // $37,000 x 2 / 37 = $2,000; $74,000 - $2,000 = $72,000
      const result = applyFederalItemizedLimit(
        itemized(74000),
        805700,
        TOP_BRACKET_START,
        federalLimits,
      );

      expect(result.highIncomeReduction).toBe(2000);
      expect(result.deductionAmount).toBe(72000);
    });

    it("does nothing when income is exactly at the top bracket", () => {
      const breakdown = itemized(74000);

      expect(
        applyFederalItemizedLimit(
          breakdown,
          TOP_BRACKET_START,
          TOP_BRACKET_START,
          federalLimits,
        ),
      ).toBe(breakdown);
    });

    it("removes 2/37 of a dollar when income is one dollar into the top bracket", () => {
      // $1 x 2 / 37 = $0.054
      const result = applyFederalItemizedLimit(
        itemized(74000),
        TOP_BRACKET_START + 1,
        TOP_BRACKET_START,
        federalLimits,
      );

      expect(result.highIncomeReduction).toBeCloseTo(0.054, 3);
      expect(result.deductionAmount).toBeCloseTo(73999.95, 2);
    });

    it("falls back to the standard deduction when the reduced amount equals it", () => {
      // $34,040 x 2 / 37 = $1,840; $34,040 - $1,840 = $32,200, the standard
      // deduction, and a tie goes to standard
      const result = applyFederalItemizedLimit(
        itemized(34040),
        TOP_BRACKET_START + 34040,
        TOP_BRACKET_START,
        federalLimits,
      );

      expect(result.itemizedDeduction).toBe(32200);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(32200);
    });

    it("stays itemized when the reduced amount is one dollar more than the standard deduction", () => {
      // Income is $34,040 over the top bracket, less than the $34,041 of
      // deductions: $34,040 x 2 / 37 = $1,840; $34,041 - $1,840 = $32,201
      const result = applyFederalItemizedLimit(
        itemized(34041),
        TOP_BRACKET_START + 34040,
        TOP_BRACKET_START,
        federalLimits,
      );

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(32201);
    });

    it("reports no itemized components after falling back to standard", () => {
      // $33,300 x 2 / 37 = $1,800; $33,300 - $1,800 = $31,500, below $32,200
      const result = applyFederalItemizedLimit(
        itemized(33300),
        2000000,
        TOP_BRACKET_START,
        federalLimits,
      );

      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(32200);
      expect(result.itemizedDeduction).toBe(31500);
      expect(result.saltDeduction).toBe(0);
      expect(result.saltCapped).toBe(false);
      expect(result.mortgageInterest).toBe(0);
      expect(result.highIncomeReduction).toBeUndefined();
    });

    it("stays itemized below the standard deduction when the choice is itemized", () => {
      // Same figures: $31,500 is kept although the standard is $32,200
      const result = applyFederalItemizedLimit(
        itemized(33300),
        2000000,
        TOP_BRACKET_START,
        federalLimits,
        "itemized",
      );

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(31500);
      expect(result.highIncomeReduction).toBe(1800);
      expect(result.mortgageInterest).toBe(23300);
    });

    it("leaves a return that takes the standard deduction untouched", () => {
      const breakdown = createFederalBreakdown({
        standardDeduction: 32200,
        itemizedDeduction: 20000,
        deductionAmount: 32200,
      });

      expect(
        applyFederalItemizedLimit(
          breakdown,
          2000000,
          TOP_BRACKET_START,
          federalLimits,
        ),
      ).toBe(breakdown);
    });

    it("does not apply in 2025", () => {
      const breakdown = itemized(74000);

      expect(
        applyFederalItemizedLimit(
          breakdown,
          1000000,
          751600,
          loadTestDataForYear("2025").federalLimits,
        ),
      ).toBe(breakdown);
    });
  });
});

describe("California deductions", () => {
  // AGI below the $252,203 high-income limit
  const AGI = 100000;

  const california = (
    overrides: Partial<DeductionInputs>,
    filingStatus: FilingStatus = "single",
    agi: number = AGI,
  ) =>
    calculateCaliforniaDeductions(
      createDefaultDeductionInputs(overrides),
      filingStatus,
      californiaDeductions,
      californiaLimits,
      agi,
    );

  describe("what is deductible", () => {
    it("deducts $50,000 of property tax in full, with no SALT cap", () => {
      const result = california({ propertyTaxesPaid: 50000 });

      expect(result.propertyTax).toBe(50000);
      expect(result.itemizedDeduction).toBe(50000);
      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(50000);
    });

    it("does not deduct state income tax", () => {
      // $65,000 of state income tax paid; only the $10,000 of property tax
      // counts
      const result = california({
        stateTaxWithheld: 50000,
        stateEstimatedPaid: 10000,
        priorYearStateBalancePaid: 5000,
        propertyTaxesPaid: 10000,
      });

      expect(result.saltDeduction).toBe(0);
      expect(result.itemizedDeduction).toBe(10000);
    });

    it("deducts charitable giving in full, without the federal 0.5% floor", () => {
      // The federal floor would remove 0.5% x $100,000 = $500
      const result = california({ charitableContributions: 10000 });

      expect(result.charitableContributions).toBe(10000);
      expect(result.itemizedDeduction).toBe(10000);
    });

    it("adds property tax, mortgage interest and charitable giving", () => {
      // $20,000 + $10,000 + $5,000 = $35,000
      const result = california({
        propertyTaxesPaid: 20000,
        mortgageInterestPaid: 10000,
        charitableContributions: 5000,
      });

      expect(result.itemizedDeduction).toBe(35000);
      expect(result.highIncomeReduction).toBe(0);
    });
  });

  describe("mortgage interest", () => {
    const mortgageInterest = (
      mortgageBalance: number,
      filingStatus: FilingStatus = "single",
    ) =>
      california({ mortgageInterestPaid: 40000, mortgageBalance }, filingStatus)
        .mortgageInterest;

    it("deducts all the interest on a balance of exactly $1,000,000", () => {
      expect(mortgageInterest(1000000)).toBe(40000);
    });

    it("deducts the share of interest on the first $1,000,000", () => {
      // $1,000,000 / $1,250,000 x $40,000 = $32,000
      expect(mortgageInterest(1250000)).toBe(32000);
    });

    it("deducts all the interest on exactly $500,000 when married filing separately", () => {
      expect(mortgageInterest(500000, "marriedFilingSeparately")).toBe(40000);
    });

    it("limits married filing separately to the first $500,000", () => {
      // $500,000 / $800,000 x $40,000 = $25,000
      expect(mortgageInterest(800000, "marriedFilingSeparately")).toBe(25000);
    });
  });

  describe("high-income limit", () => {
    // $30,000 property tax + $20,000 charitable = $50,000 of deductions
    const limited = (filingStatus: FilingStatus, agi: number) =>
      california(
        { propertyTaxesPaid: 30000, charitableContributions: 20000 },
        filingStatus,
        agi,
      );

    it.each([
      ["single", 252203],
      ["marriedFilingJointly", 504411],
      ["marriedFilingSeparately", 252203],
    ] as const)(
      "does not reduce %s deductions at exactly $%i of AGI",
      (filingStatus, threshold) => {
        const result = limited(filingStatus, threshold);

        expect(result.highIncomeReduction).toBe(0);
        expect(result.itemizedDeduction).toBe(50000);
      },
    );

    it("removes six cents at $252,204, one dollar over the threshold", () => {
      // 6% x $1 = $0.06
      const result = limited("single", 252204);

      expect(result.highIncomeReduction).toBeCloseTo(0.06, 2);
      expect(result.itemizedDeduction).toBeCloseTo(49999.94, 2);
    });

    it.each([
      ["single", 352203],
      ["marriedFilingJointly", 604411],
      ["marriedFilingSeparately", 352203],
    ] as const)(
      "removes 6% of AGI over the threshold for %s at $%i",
      (filingStatus, agi) => {
        // $100,000 over the threshold x 6% = $6,000; $50,000 - $6,000 = $44,000
        const result = limited(filingStatus, agi);

        expect(result.highIncomeReduction).toBeCloseTo(6000, 2);
        expect(result.itemizedDeduction).toBeCloseTo(44000, 2);
      },
    );

    it("removes no more than 80% of the deductions", () => {
      // Single, AGI $1,252,203: 6% x $1,000,000 = $60,000
      // 80% x $50,000 = $40,000 is less, so $10,000 is left
      const result = limited("single", 1252203);

      expect(result.highIncomeReduction).toBeCloseTo(40000, 2);
      expect(result.itemizedDeduction).toBeCloseTo(10000, 2);
      expect(result.deductionUsed).toBe("itemized");
    });
  });

  describe("standard versus itemized", () => {
    it.each([
      ["single", 5900],
      ["marriedFilingJointly", 11800],
      ["marriedFilingSeparately", 5900],
    ] as const)(
      "gives %s a standard deduction of $%i",
      (filingStatus, standardDeduction) => {
        const result = california({}, filingStatus);

        expect(result.standardDeduction).toBe(standardDeduction);
        expect(result.deductionUsed).toBe("standard");
        expect(result.deductionAmount).toBe(standardDeduction);
      },
    );

    it("takes the standard deduction when itemized deductions equal it at $5,900", () => {
      const result = california({ charitableContributions: 5900 });

      expect(result.itemizedDeduction).toBe(5900);
      expect(result.deductionUsed).toBe("standard");
    });

    it("itemizes at $5,901, one dollar more than the standard deduction", () => {
      const result = california({ charitableContributions: 5901 });

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(5901);
    });

    it("compares the amount left after the high-income limit with the standard deduction", () => {
      // AGI $2,000,000: 6% of the excess is far more than 80% of $12,000
      // $12,000 - 80% x $12,000 = $2,400, below the $5,900 standard
      const result = california(
        { charitableContributions: 12000 },
        "single",
        2000000,
      );

      expect(result.itemizedDeduction).toBeCloseTo(2400, 2);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(5900);
    });

    it("reports no itemized components when the standard deduction is used", () => {
      const result = california({
        propertyTaxesPaid: 2000,
        mortgageInterestPaid: 2000,
        charitableContributions: 1000,
      });

      expect(result.itemizedDeduction).toBe(5000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.propertyTax).toBe(0);
      expect(result.mortgageInterest).toBe(0);
      expect(result.charitableContributions).toBe(0);
      expect(result.highIncomeReduction).toBe(0);
    });
  });
});

describe("New York deductions", () => {
  // AGI below the $100,000 start of the itemized deduction adjustment
  const AGI = 90000;

  const newYork = (
    overrides: Partial<DeductionInputs>,
    filingStatus: FilingStatus = "single",
    agi: number = AGI,
  ) =>
    calculateNewYorkDeductions(
      createDefaultDeductionInputs(overrides),
      filingStatus,
      newYorkDeductions,
      newYorkLimits,
      agi,
    );

  describe("what is deductible", () => {
    it("deducts $50,000 of property tax in full, with no SALT cap", () => {
      const result = newYork({ propertyTaxesPaid: 50000 });

      expect(result.propertyTax).toBe(50000);
      expect(result.itemizedDeduction).toBe(50000);
      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(50000);
    });

    it("does not deduct state income tax", () => {
      // $65,000 of state income tax paid; only the $10,000 of property tax
      // counts
      const result = newYork({
        stateTaxWithheld: 50000,
        stateEstimatedPaid: 10000,
        priorYearStateBalancePaid: 5000,
        propertyTaxesPaid: 10000,
      });

      expect(result.saltDeduction).toBe(0);
      expect(result.itemizedDeduction).toBe(10000);
    });

    it("deducts charitable giving in full, without the federal 0.5% floor", () => {
      // The federal floor would remove 0.5% x $90,000 = $450
      const result = newYork({ charitableContributions: 10000 });

      expect(result.charitableContributions).toBe(10000);
      expect(result.itemizedDeduction).toBe(10000);
    });

    it("adds property tax, mortgage interest and charitable giving", () => {
      // $12,000 + $9,000 + $2,000 = $23,000
      const result = newYork({
        propertyTaxesPaid: 12000,
        mortgageInterestPaid: 9000,
        charitableContributions: 2000,
      });

      expect(result.itemizedDeduction).toBe(23000);
      expect(result.highIncomeReduction).toBe(0);
    });
  });

  describe("mortgage interest", () => {
    const mortgageInterest = (
      mortgageBalance: number,
      filingStatus: FilingStatus = "single",
    ) =>
      newYork({ mortgageInterestPaid: 40000, mortgageBalance }, filingStatus)
        .mortgageInterest;

    it("deducts all the interest on a balance of exactly $1,000,000", () => {
      expect(mortgageInterest(1000000)).toBe(40000);
    });

    it("deducts the share of interest on the first $1,000,000", () => {
      // $1,000,000 / $1,250,000 x $40,000 = $32,000
      expect(mortgageInterest(1250000)).toBe(32000);
    });

    it("deducts all the interest on exactly $500,000 when married filing separately", () => {
      expect(mortgageInterest(500000, "marriedFilingSeparately")).toBe(40000);
    });

    it("limits married filing separately to the first $500,000", () => {
      // $500,000 / $800,000 x $40,000 = $25,000
      expect(mortgageInterest(800000, "marriedFilingSeparately")).toBe(25000);
    });
  });

  describe("itemized deduction adjustment", () => {
    // $20,000 property tax + $20,000 charitable = $40,000 of deductions
    const adjusted = (agi: number, filingStatus: FilingStatus = "single") =>
      newYork(
        { propertyTaxesPaid: 20000, charitableContributions: 20000 },
        filingStatus,
        agi,
      );

    it("allows the deductions in full at exactly $100,000 of AGI", () => {
      const result = adjusted(100000);

      expect(result.itemizedDeduction).toBe(40000);
      expect(result.highIncomeReduction).toBe(0);
    });

    it("phases in a 25% reduction over the $50,000 above $100,000", () => {
      // $120,000 is $20,000 / $50,000 = 0.4 of the way: 0.4 x 25% = 10%
      // $40,000 - 10% x $40,000 = $36,000
      const result = adjusted(120000);

      expect(result.itemizedDeduction).toBeCloseTo(36000, 2);
      expect(result.highIncomeReduction).toBeCloseTo(4000, 2);
    });

    it("rounds the phase-in share to four decimal places", () => {
      // $20,002 / $50,000 = 0.40004, rounded to 0.4000, so the result is the
      // same as at $120,000 (unrounded it would be $35,999.60)
      expect(adjusted(120002).itemizedDeduction).toBeCloseTo(36000, 2);
    });

    it("removes 25% at $150,000", () => {
      // $40,000 - 25% x $40,000 = $30,000
      expect(adjusted(150000).itemizedDeduction).toBe(30000);
    });

    it("still removes 25% at exactly $475,000", () => {
      expect(adjusted(475000).itemizedDeduction).toBe(30000);
    });

    it("phases from 25% to 50% over the $50,000 above $475,000", () => {
      // $500,000 is halfway: 25% + 0.5 x 25% = 37.5%
      // $40,000 - 37.5% x $40,000 = $25,000
      expect(adjusted(500000).itemizedDeduction).toBe(25000);
    });

    it("removes 50% at $525,000", () => {
      // $40,000 - 50% x $40,000 = $20,000
      expect(adjusted(525000).itemizedDeduction).toBe(20000);
    });

    it("starts the first phase-in at $200,000 for married filing jointly", () => {
      // $225,000 is halfway: 0.5 x 25% = 12.5%; $40,000 - $5,000 = $35,000
      expect(adjusted(200000, "marriedFilingJointly").itemizedDeduction).toBe(
        40000,
      );
      expect(adjusted(225000, "marriedFilingJointly").itemizedDeduction).toBe(
        35000,
      );
      expect(adjusted(250000, "marriedFilingJointly").itemizedDeduction).toBe(
        30000,
      );
    });

    it("starts the first phase-in at $100,000 for married filing separately", () => {
      // $125,000 is halfway: 0.5 x 25% = 12.5%; $40,000 - $5,000 = $35,000
      expect(
        adjusted(100000, "marriedFilingSeparately").itemizedDeduction,
      ).toBe(40000);
      expect(
        adjusted(125000, "marriedFilingSeparately").itemizedDeduction,
      ).toBe(35000);
    });

    it("still removes 50% of all deductions at exactly $1,000,000", () => {
      // $40,000 - 50% x $40,000 = $20,000
      const result = adjusted(1000000);

      expect(result.itemizedDeduction).toBe(20000);
      expect(result.highIncomeReduction).toBe(20000);
    });

    it("allows only 50% of charitable giving at $1,000,001", () => {
      // 50% x $20,000 = $10,000; the $20,000 of property tax is lost
      const result = adjusted(1000001);

      expect(result.itemizedDeduction).toBe(10000);
      expect(result.highIncomeReduction).toBe(30000);
    });

    it("still allows 50% of charitable giving at exactly $10,000,000", () => {
      expect(adjusted(10000000).itemizedDeduction).toBe(10000);
    });

    it("allows only 25% of charitable giving at $10,000,001", () => {
      // 25% x $20,000 = $5,000
      expect(adjusted(10000001).itemizedDeduction).toBe(5000);
    });
  });

  describe("standard versus itemized", () => {
    it.each([
      ["single", 8000],
      ["marriedFilingJointly", 16050],
      ["marriedFilingSeparately", 8000],
    ] as const)(
      "gives %s a standard deduction of $%i",
      (filingStatus, standardDeduction) => {
        const result = newYork({}, filingStatus);

        expect(result.standardDeduction).toBe(standardDeduction);
        expect(result.deductionUsed).toBe("standard");
        expect(result.deductionAmount).toBe(standardDeduction);
      },
    );

    it("takes the standard deduction when itemized deductions equal it at $8,000", () => {
      const result = newYork({ charitableContributions: 8000 });

      expect(result.itemizedDeduction).toBe(8000);
      expect(result.deductionUsed).toBe("standard");
    });

    it("itemizes at $8,001, one dollar more than the standard deduction", () => {
      const result = newYork({ charitableContributions: 8001 });

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(8001);
    });

    it("compares the amount left after the adjustment with the standard deduction", () => {
      // Married filing jointly, AGI $1,500,000: 50% x $20,000 of charitable
      // giving = $10,000, below the $16,050 standard deduction
      const result = newYork(
        { propertyTaxesPaid: 40000, charitableContributions: 20000 },
        "marriedFilingJointly",
        1500000,
      );

      expect(result.itemizedDeduction).toBe(10000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(16050);
    });

    it("reports no itemized components when the standard deduction is used", () => {
      const result = newYork({
        propertyTaxesPaid: 3000,
        mortgageInterestPaid: 2000,
        charitableContributions: 1000,
      });

      expect(result.itemizedDeduction).toBe(6000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.propertyTax).toBe(0);
      expect(result.mortgageInterest).toBe(0);
      expect(result.charitableContributions).toBe(0);
      expect(result.highIncomeReduction).toBe(0);
    });
  });
});

describe("DC deductions", () => {
  // AGI below the $200,000 high-income limit
  const AGI = 150000;

  const dc = (
    overrides: Partial<DeductionInputs>,
    filingStatus: FilingStatus = "single",
    agi: number = AGI,
    federalDeduction?: DeductionBreakdown,
  ) =>
    calculateDCDeductions(
      createDefaultDeductionInputs(overrides),
      filingStatus,
      dcDeductions,
      federalLimits,
      dcLimits,
      agi,
      federalDeduction,
    );

  describe("what is deductible", () => {
    it("deducts $50,000 of property tax in full, with no SALT cap", () => {
      const result = dc({ propertyTaxesPaid: 50000 });

      expect(result.propertyTax).toBe(50000);
      expect(result.itemizedDeduction).toBe(50000);
      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(50000);
    });

    it("does not deduct DC income tax", () => {
      // $37,000 of DC income tax paid; only the $20,000 of property tax counts
      const result = dc({
        stateTaxWithheld: 30000,
        stateEstimatedPaid: 5000,
        priorYearStateBalancePaid: 2000,
        propertyTaxesPaid: 20000,
      });

      expect(result.saltDeduction).toBe(0);
      expect(result.itemizedDeduction).toBe(20000);
    });

    it("adds property tax, mortgage interest and charitable giving", () => {
      // $10,000 + $8,000 + $4,000 = $22,000
      const result = dc({
        propertyTaxesPaid: 10000,
        mortgageInterestPaid: 8000,
        charitableContributions: 4000,
      });

      expect(result.itemizedDeduction).toBe(22000);
      expect(result.highIncomeReduction).toBe(0);
    });
  });

  describe("mortgage interest", () => {
    // DC uses the federal limits. AGI of $90,000 keeps married filing
    // separately under its $100,000 high-income limit.
    const mortgageInterest = (
      mortgageBalance: number,
      filingStatus: FilingStatus = "single",
      isMortgageGrandfathered = false,
    ) =>
      dc(
        { mortgageInterestPaid: 40000, mortgageBalance, isMortgageGrandfathered },
        filingStatus,
        90000,
      ).mortgageInterest;

    it("deducts all the interest on a balance of exactly $750,000", () => {
      expect(mortgageInterest(750000)).toBe(40000);
    });

    it("deducts the share of interest on the first $750,000", () => {
      // $750,000 / $1,000,000 x $40,000 = $30,000
      expect(mortgageInterest(1000000)).toBe(30000);
    });

    it("limits married filing separately to the first $375,000", () => {
      // $375,000 / $500,000 x $40,000 = $30,000
      expect(mortgageInterest(500000, "marriedFilingSeparately")).toBe(30000);
    });

    it("allows $1,000,000 for a loan from before December 16, 2017", () => {
      expect(mortgageInterest(1000000, "single", true)).toBe(40000);
    });
  });

  describe("high-income limit", () => {
    // $30,000 property tax + $20,000 charitable = $50,000 of deductions
    const limited = (agi: number, filingStatus: FilingStatus = "single") =>
      dc(
        { propertyTaxesPaid: 30000, charitableContributions: 20000 },
        filingStatus,
        agi,
      );

    it("does not reduce deductions at exactly $200,000 of AGI", () => {
      const result = limited(200000);

      expect(result.highIncomeReduction).toBe(0);
      expect(result.itemizedDeduction).toBe(50000);
    });

    it("removes five cents at $200,001, one dollar over the threshold", () => {
      // 5% x $1 = $0.05
      const result = limited(200001);

      expect(result.highIncomeReduction).toBeCloseTo(0.05, 2);
      expect(result.itemizedDeduction).toBeCloseTo(49999.95, 2);
    });

    it("removes 5% of AGI over $200,000", () => {
      // 5% x ($300,000 - $200,000) = $5,000; $50,000 - $5,000 = $45,000
      const result = limited(300000);

      expect(result.highIncomeReduction).toBe(5000);
      expect(result.itemizedDeduction).toBe(45000);
    });

    it("uses the same $200,000 threshold for married filing jointly", () => {
      expect(limited(200000, "marriedFilingJointly").itemizedDeduction).toBe(
        50000,
      );
      expect(limited(300000, "marriedFilingJointly").itemizedDeduction).toBe(
        45000,
      );
    });

    it("does not reduce married filing separately deductions at exactly $100,000", () => {
      expect(limited(100000, "marriedFilingSeparately").itemizedDeduction).toBe(
        50000,
      );
    });

    it("removes 5% of AGI over $100,000 for married filing separately", () => {
      // 5% x ($200,000 - $100,000) = $5,000; $50,000 - $5,000 = $45,000
      expect(limited(200000, "marriedFilingSeparately").itemizedDeduction).toBe(
        45000,
      );
    });

    it("removes all the deductions when 5% of the excess equals them", () => {
      // 5% x ($1,200,000 - $200,000) = $50,000; $50,000 - $50,000 = $0
      expect(limited(1200000).itemizedDeduction).toBe(0);
    });

    it("never reduces the deductions below zero", () => {
      // 5% x ($2,200,000 - $200,000) = $100,000, more than the $50,000
      expect(limited(2200000).itemizedDeduction).toBe(0);
    });
  });

  describe("standard versus itemized without a federal breakdown", () => {
    it.each([
      ["single", 16100],
      ["marriedFilingJointly", 32200],
      ["marriedFilingSeparately", 16100],
    ] as const)(
      "gives %s a standard deduction of $%i",
      (filingStatus, standardDeduction) => {
        const result = dc({}, filingStatus, 90000);

        expect(result.standardDeduction).toBe(standardDeduction);
        expect(result.deductionUsed).toBe("standard");
        expect(result.deductionAmount).toBe(standardDeduction);
      },
    );

    it("takes the standard deduction when itemized deductions equal it at $16,100", () => {
      const result = dc({ propertyTaxesPaid: 16100 });

      expect(result.itemizedDeduction).toBe(16100);
      expect(result.deductionUsed).toBe("standard");
      expect(result.propertyTax).toBe(0);
    });

    it("itemizes at $16,101, one dollar more than the standard deduction", () => {
      const result = dc({ propertyTaxesPaid: 16101 });

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(16101);
    });

    it("compares the amount left after the high-income limit with the standard deduction", () => {
      // 5% x ($900,000 - $200,000) = $35,000; $50,000 - $35,000 = $15,000,
      // below the $16,100 standard deduction
      const result = dc(
        { propertyTaxesPaid: 50000 },
        "single",
        900000,
      );

      expect(result.itemizedDeduction).toBe(15000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(16100);
      expect(result.highIncomeReduction).toBe(0);
    });

    it("does not say the choice follows the federal return", () => {
      expect(dc({}).followsFederalChoice).toBe(false);
    });
  });

  describe("following the federal return", () => {
    const federalItemized = createFederalBreakdown({
      itemizedDeduction: 20000,
      deductionUsed: "itemized",
      deductionAmount: 20000,
      saltDeduction: 13000,
      mortgageInterest: 5000,
      charitableContributions: 2000,
    });
    const federalStandard = createFederalBreakdown();

    it("itemizes when the federal return does, even below the $16,100 DC standard deduction", () => {
      // $3,000 property tax + $5,000 mortgage interest + $2,000 charitable
      // = $10,000
      const result = dc(
        { propertyTaxesPaid: 3000 },
        "single",
        AGI,
        federalItemized,
      );

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(10000);
      expect(result.followsFederalChoice).toBe(true);
    });

    it("takes the standard deduction when the federal return does, even when $30,000 could be itemized", () => {
      const result = dc(
        { propertyTaxesPaid: 30000 },
        "single",
        AGI,
        federalStandard,
      );

      expect(result.itemizedDeduction).toBe(30000);
      expect(result.deductionUsed).toBe("standard");
      expect(result.deductionAmount).toBe(16100);
      expect(result.propertyTax).toBe(0);
      expect(result.followsFederalChoice).toBe(true);
    });

    it("uses the federal mortgage interest and charitable amounts", () => {
      // The $40,000 of interest and $9,000 of giving entered were limited to
      // $5,000 and $2,000 on the federal return
      // $10,000 property tax + $5,000 + $2,000 = $17,000
      const result = dc(
        {
          propertyTaxesPaid: 10000,
          mortgageInterestPaid: 40000,
          charitableContributions: 9000,
        },
        "single",
        AGI,
        federalItemized,
      );

      expect(result.mortgageInterest).toBe(5000);
      expect(result.charitableContributions).toBe(2000);
      expect(result.itemizedDeduction).toBe(17000);
    });

    it("does not carry over the federal deduction for state income tax", () => {
      // The federal breakdown has $13,000 of SALT; DC allows only the
      // property tax entered, here none: $5,000 + $2,000 = $7,000
      const result = dc({}, "single", AGI, federalItemized);

      expect(result.saltDeduction).toBe(0);
      expect(result.itemizedDeduction).toBe(7000);
    });

    it("itemizes $0 when the high-income limit removes everything", () => {
      // $7,000 of deductions; 5% x ($1,000,000 - $200,000) = $40,000
      const result = dc({}, "single", 1000000, federalItemized);

      expect(result.deductionUsed).toBe("itemized");
      expect(result.deductionAmount).toBe(0);
      expect(result.highIncomeReduction).toBe(7000);
    });
  });
});
