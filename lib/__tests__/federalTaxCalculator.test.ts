import { describe, it, expect, beforeAll } from "vitest";
import { calculateFederalTax } from "../federalTaxCalculator";
import {
  federalBrackets,
  ltcgBrackets,
  federalDeductions,
  sharedLimits,
  federalLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";
import { SUPPORTED_YEARS, TaxYear } from "../config";

describe("calculateFederalTax", () => {
  describe("basic bracket math", () => {
    it("calculates tax correctly for single filer with $100,000 W-2 income", () => {
      // $100,000 income - $16,100 standard deduction = $83,900 taxable
      // Bracket breakdown:
      // $12,400 @ 10% = $1,240.00
      // $38,000 ($50,400 - $12,400) @ 12% = $4,560.00
      // $33,500 ($83,900 - $50,400) @ 22% = $7,370.00
      // Total ordinary income tax = $13,170
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(83900);
      expect(result.ordinaryIncomeTax).toBe(13170);
    });

    it("calculates tax correctly through every bracket for married filing jointly with $1,000,000 W-2 income", () => {
      // $1,000,000 income - $32,200 standard deduction = $967,800 taxable
      // Bracket breakdown:
      // $24,800 @ 10% = $2,480.00
      // $76,000 ($100,800 - $24,800) @ 12% = $9,120.00
      // $110,600 ($211,400 - $100,800) @ 22% = $24,332.00
      // $192,150 ($403,550 - $211,400) @ 24% = $46,116.00
      // $108,900 ($512,450 - $403,550) @ 32% = $34,848.00
      // $256,250 ($768,700 - $512,450) @ 35% = $89,687.50
      // $199,100 ($967,800 - $768,700) @ 37% = $73,667.00
      // Total ordinary income tax = $280,250.50
      const inputs = createDefaultInputs({
        federalIncome: 1000000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(967800);
      expect(result.ordinaryIncomeTax).toBeCloseTo(280250.5, 2);
    });
  });

  describe("FICA taxes", () => {
    it("caps Social Security tax at wage base and applies additional Medicare above threshold", () => {
      // $250,000 wages for single filer
      // SS: $184,500 * 6.2% = $11,439.00 (capped at wage base)
      // Medicare base: $250,000 * 1.45% = $3,625
      // Additional Medicare: ($250,000 - $200,000) * 0.9% = $450
      // Total FICA = $15,514.00
      const inputs = createDefaultInputs({
        federalIncome: 250000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.ficaBreakdown).toBeDefined();
      expect(result.ficaBreakdown!.socialSecurityWages).toBe(184500);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(11439, 2);
      expect(result.ficaBreakdown!.medicareTax).toBeCloseTo(3625, 2);
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(450, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(15514, 2);
    });
  });

  describe("long-term capital gains", () => {
    it("applies preferential 0% rate for LTCG within bracket threshold", () => {
      // Single filer with $30,000 LTCG and no ordinary income
      // Standard deduction ($16,100) reduces LTCG when there is no ordinary income
      // LTCG bracket: $49,450 at 0%, so the remaining $13,900 is all at 0%
      const inputs = createDefaultInputs({
        longTermCapitalGains: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableLTCG).toBe(13900);
      expect(result.ltcgTax).toBe(0);
    });

    it("applies 15% rate for LTCG above 0% threshold", () => {
      // Single filer with $100,000 LTCG and no ordinary income
      // Taxable LTCG = $100,000 - $16,100 std = $83,900
      // LTCG: $49,450 at 0% = $0, $34,450 at 15% = $5,167.50
      const inputs = createDefaultInputs({
        longTermCapitalGains: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableLTCG).toBe(83900);
      expect(result.ltcgTax).toBeCloseTo(5167.5, 2);
    });
  });

  describe("401k contributions", () => {
    it("reduces taxable ordinary income by 401k contributions", () => {
      // $100,000 income - $23,500 (401k) - $16,100 (std deduction) = $60,400 taxable
      // Bracket breakdown:
      // $12,400 @ 10% = $1,240.00
      // $38,000 @ 12% = $4,560.00
      // $10,000 ($60,400 - $50,400) @ 22% = $2,200.00
      // Total = $8,000
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(60400);
      expect(result.ordinaryIncomeTax).toBe(8000);
    });
  });

  describe("pre-tax medical deductions", () => {
    it("reduces taxable ordinary income by pre-tax medical contributions", () => {
      // $100,000 income - $10,000 (pre-tax medical) - $16,100 (std deduction) = $73,900 taxable
      // Bracket breakdown:
      // $12,400 @ 10% = $1,240.00
      // $38,000 @ 12% = $4,560.00
      // $23,500 ($73,900 - $50,400) @ 22% = $5,170.00
      // Total = $10,970
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        preTaxMedical: 10000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(73900);
      expect(result.ordinaryIncomeTax).toBe(10970);
      expect(result.preTaxMedical).toBe(10000);
    });

    it("combines with 401k contributions to reduce taxable income", () => {
      // $100,000 income - $23,500 (401k) - $5,000 (pre-tax medical) - $16,100 (std deduction) = $55,400 taxable
      // Bracket breakdown:
      // $12,400 @ 10% = $1,240.00
      // $38,000 @ 12% = $4,560.00
      // $5,000 ($55,400 - $50,400) @ 22% = $1,100.00
      // Total = $6,900
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        preTaxMedical: 5000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(55400);
      expect(result.ordinaryIncomeTax).toBe(6900);
      expect(result.contributions401k).toBe(23500);
      expect(result.preTaxMedical).toBe(5000);
    });
  });

  describe("negative LTCG (current year losses)", () => {
    it("deducts up to $3,000 of a net long-term loss and carries over the rest", () => {
      // $100,000 federal income with -$50,000 LTCG loss
      // $3,000 is deductible against other income, $47,000 carries over
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Gross income should only include federal income (LTCG clamped to 0)
      expect(result.grossIncome).toBe(100000);
      // LTCG tax should be 0 (no gains to tax)
      expect(result.ltcgTax).toBe(0);
      expect(result.taxableLTCG).toBe(0);
      // Original negative value should still be in result for display
      expect(result.longTermCapitalGains).toBe(-50000);
      expect(result.longTermLossCarryoverOffset).toBe(3000);
      expect(result.longTermLossCarryoverUnused).toBe(47000);
      // $100,000 - $3,000 - $16,100 std
      expect(result.taxableOrdinaryIncome).toBe(80900);
    });

    it("offsets short-term gains with a long-term loss", () => {
      // $100,000 wages, $30,000 STCG, -$4,000 LTCG
      // Net short-term gain = $30,000 - $4,000 = $26,000
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 30000,
        longTermCapitalGains: -4000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.longTermLossCarryoverOffset).toBe(4000);
      expect(result.longTermLossCarryoverUnused).toBe(0);
      // $100,000 + $26,000 - $16,100 std
      expect(result.taxableOrdinaryIncome).toBe(109900);
      expect(result.taxableLTCG).toBe(0);
    });
  });

  describe("negative STCG (current year short-term losses)", () => {
    it("treats negative STCG as $0 for gross income but adds to carryover", () => {
      // $100,000 federal income with -$10,000 STCG loss
      // The loss should be treated as carryover, offsetting up to $3,000 ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: -10000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Gross income should not include negative STCG
      expect(result.grossIncome).toBe(100000);
      // The $10,000 loss becomes carryover, $3,000 offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      // Taxable ordinary = $100k - $3k - $16.1k std = $80,900
      expect(result.taxableOrdinaryIncome).toBe(80900);
    });

    it("combines negative STCG with prior year carryover", () => {
      // $100,000 federal income, -$5,000 STCG, $2,000 prior carryover
      // Combined carryover = $7,000, offsets $3,000 ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: -5000,
        priorYearShortTermLossCarryover: 2000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Combined $7,000 carryover, $3,000 offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(4000);
    });

    it("applies $3,000 limit even with large current year loss", () => {
      // Large negative STCG should still only offset $3,000 ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: -50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Only $3,000 can offset ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(47000);
    });
  });

  describe("safe harbor calculations", () => {
    it("uses minimum of 90% current year and 110% prior year when prior year provided", () => {
      // $100k income, tax is $13,170 + FICA
      // FICA: $100k * 6.2% = $6,200 (SS) + $100k * 1.45% = $1,450 (Medicare) = $7,650
      // Total tax = $13,170 + $7,650 = $20,820
      // 90% of current year = $18,738
      // Prior year tax = $15,000, so 110% = $16,500
      // Safe harbor minimum should be $16,500 (the lesser of the two)
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearFederalTaxPaid: 15000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        20820 * 0.9,
        2,
      );
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(16500);
      expect(result.safeHarbor!.minimum).toBe(16500);
    });

    it("uses only 90% current year when no prior year tax provided", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearFederalTaxPaid: 0,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.minimum).toBeCloseTo(result.totalTax * 0.9, 2);
    });
  });

  describe("short-term loss carryover edge cases", () => {
    it("offsets ST gains first, then ordinary income up to $3,000 limit", () => {
      // $50,000 wage income, $10,000 ST gains, $15,000 ST loss carryover
      // ST loss first offsets $10,000 ST gains, leaving $5,000 carryover
      // Then $3,000 of remaining carryover offsets ordinary income
      // Gross ordinary = $50,000 + $10,000 - $10,000 - $3,000 = $47,000
      // After std deduction: $47,000 - $16,100 = $30,900 taxable
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 10000,
        priorYearShortTermLossCarryover: 15000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.shortTermLossCarryoverOffset).toBe(13000); // 10k ST + 3k ordinary
      expect(result.taxableOrdinaryIncome).toBe(30900);
    });

    it("limits ordinary income offset to $1,500 for MFS", () => {
      // MFS gets only $1,500 limit instead of $3,000
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 0,
        priorYearShortTermLossCarryover: 5000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      // Only $1,500 can offset ordinary income for MFS
      expect(result.shortTermLossCarryoverOffset).toBe(1500);
    });

    it("does not apply loss carryover when no income to offset", () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        shortTermCapitalGains: 0,
        priorYearShortTermLossCarryover: 10000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.shortTermLossCarryoverOffset).toBe(0);
    });
  });

  describe("long-term loss carryover edge cases", () => {
    it("offsets LTCG, then up to $3,000 of ordinary income", () => {
      // $100,000 wage income, $20,000 LTCG, $50,000 LT loss carryover
      // LT loss offsets the $20,000 LTCG, then $3,000 of ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.longTermLossCarryoverOffset).toBe(23000);
      expect(result.longTermLossCarryoverUnused).toBe(27000);
      expect(result.taxableLTCG).toBe(0);
      expect(result.taxableOrdinaryIncome).toBe(80900); // 100k - 3k - 16.1k std
    });

    it("partially offsets LTCG when carryover is less than gains", () => {
      const inputs = createDefaultInputs({
        longTermCapitalGains: 100000,
        priorYearLongTermLossCarryover: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.longTermLossCarryoverOffset).toBe(30000);
      // $70,000 net gain - $16,100 std (no ordinary income to absorb it)
      expect(result.taxableLTCG).toBe(53900);
    });
  });

  describe("combined ST and LT loss carryovers", () => {
    it("applies both ST and LT carryovers correctly", () => {
      // Complex scenario: wage income + both types of gains + both types of losses
      const inputs = createDefaultInputs({
        federalIncome: 80000,
        shortTermCapitalGains: 15000,
        longTermCapitalGains: 25000,
        priorYearShortTermLossCarryover: 20000, // exceeds ST gains
        priorYearLongTermLossCarryover: 10000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      // ST loss: $15k offsets ST gains, remaining $5k offsets net LT gains
      expect(result.shortTermLossCarryoverOffset).toBe(20000);
      expect(result.shortTermLossCarryoverUnused).toBe(0);
      // LT loss: $10k offsets LT gains
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.taxableLTCG).toBe(10000); // 25k - 10k - 5k
      // No net loss remains, so ordinary income is unaffected
      expect(result.taxableOrdinaryIncome).toBe(63900); // 80k - 16.1k std
    });
  });

  describe("LTCG bracket stacking on ordinary income", () => {
    it("stacks LTCG on top of ordinary income for bracket calculation", () => {
      // $39,650 taxable ordinary + $20k LTCG = $59,650 total
      // 0% LTCG threshold for single = $49,450
      // Room in 0% bracket = $49,450 - $39,650 = $9,800
      // So $9,800 LTCG at 0%, $10,200 LTCG at 15%
      // LTCG tax = $10,200 * 0.15 = $1,530
      const inputs = createDefaultInputs({
        federalIncome: 55750, // 55,750 - 16,100 std = $39,650 taxable ordinary
        longTermCapitalGains: 20000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(39650);
      expect(result.taxableLTCG).toBe(20000);

      // Verify LTCG is split across 0% and 15% brackets
      expect(result.ltcgBracketBreakdown).toHaveLength(2);
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0);
      expect(result.ltcgBracketBreakdown[0].incomeInBracket).toBe(9800);
      expect(result.ltcgBracketBreakdown[1].rate).toBe(0.15);
      expect(result.ltcgBracketBreakdown[1].incomeInBracket).toBe(10200);

      expect(result.ltcgTax).toBeCloseTo(10200 * 0.15, 2);
    });

    it("all LTCG at 15% when ordinary income fills 0% bracket", () => {
      // $59,650 taxable ordinary (above $49,450 threshold) + $20k LTCG
      // All LTCG taxed at 15%
      const inputs = createDefaultInputs({
        federalIncome: 75750, // 75,750 - 16,100 = $59,650 taxable
        longTermCapitalGains: 20000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(59650);
      expect(result.ltcgBracketBreakdown).toHaveLength(1);
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0.15);
      expect(result.ltcgBracketBreakdown[0].incomeInBracket).toBe(20000);
      expect(result.ltcgTax).toBeCloseTo(20000 * 0.15, 2);
    });

    it("all LTCG at 0% when no ordinary income", () => {
      // $30k LTCG only ($13,900 after std deduction), well under $49,450 threshold
      const inputs = createDefaultInputs({
        longTermCapitalGains: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(13900);
      expect(result.ltcgBracketBreakdown).toHaveLength(1);
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0);
      expect(result.ltcgTax).toBe(0);
    });
  });

  describe("long-term loss carryover with LTCG in 0% bracket", () => {
    it("uses carryover even when all LTCG in 0% bracket", () => {
      // Low ordinary income, LTCG entirely in 0% bracket
      // Schedule D requires carryover to offset gains regardless of rate
      const inputs = createDefaultInputs({
        federalIncome: 20000, // taxable = 20k - 16.1k = $3,900
        longTermCapitalGains: 30000, // still under $49,450 threshold
        priorYearLongTermLossCarryover: 10000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(3900);
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.longTermLossCarryoverUnused).toBe(0);
      expect(result.taxableLTCG).toBe(20000);
      expect(result.ltcgTax).toBe(0);
    });

    it("uses full carryover when LTCG spans 0% and 15% brackets", () => {
      // LTCG spans 0% and 15% brackets, carryover offsets gains in both
      const inputs = createDefaultInputs({
        federalIncome: 55750, // taxable = $39,650
        longTermCapitalGains: 30000,
        priorYearLongTermLossCarryover: 25000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.longTermLossCarryoverOffset).toBe(25000);
      expect(result.longTermLossCarryoverUnused).toBe(0);

      // Taxable LTCG = $30k - $25k = $5,000
      // Room in 0% bracket = $49,450 - $39,650 = $9,800, so no tax
      expect(result.taxableLTCG).toBe(5000);
      expect(result.ltcgTax).toBe(0);
    });

    it("uses full carryover when all LTCG above 0% bracket", () => {
      // High ordinary income fills 0% bracket entirely
      const inputs = createDefaultInputs({
        federalIncome: 75750, // taxable = $59,650 (above $49,450)
        longTermCapitalGains: 50000,
        priorYearLongTermLossCarryover: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      // All LTCG would be taxed at 15%, so use full carryover
      expect(result.longTermLossCarryoverOffset).toBe(30000);
      expect(result.longTermLossCarryoverUnused).toBe(0);
      expect(result.taxableLTCG).toBe(20000);
      expect(result.ltcgTax).toBeCloseTo(20000 * 0.15, 2);
    });

    it("handles edge case where carryover exactly equals taxed LTCG", () => {
      // Room in 0% bracket = $49,450 - $39,650 = $9,800
      // LTCG in taxed brackets = $20,000 - $9,800 = $10,200
      // Carryover of $10,200 exactly offsets the taxed portion
      const inputs = createDefaultInputs({
        federalIncome: 55750, // taxable = $39,650
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 10200, // exactly matches taxed portion
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.longTermLossCarryoverOffset).toBe(10200);
      expect(result.longTermLossCarryoverUnused).toBe(0);
      expect(result.taxableLTCG).toBe(9800);
      expect(result.ltcgTax).toBe(0);
    });
  });

  describe("bracket boundary edge cases", () => {
    it("taxes income exactly at first bracket boundary correctly", () => {
      // Taxable income = $27,675 - $16,100 std = $11,575
      // All at 10% = $1,157.50
      const inputs = createDefaultInputs({
        federalIncome: 27675,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(11575);
      expect(result.ordinaryIncomeTax).toBe(1157.5); // all at 10%
    });

    it("taxes $1 over bracket boundary at higher rate", () => {
      // Taxable income = $28,501 - $16,100 = $12,401
      // $12,400 @ 10% = $1,240, $1 @ 12% = $0.12
      const inputs = createDefaultInputs({
        federalIncome: 28501,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(12401);
      // $12,400 @ 10% + $1 @ 12% = $1,240.12
      expect(result.ordinaryIncomeTax).toBeCloseTo(1240.12, 2);
    });

    it("handles top bracket (37%) with no upper limit", () => {
      // Very high income in top bracket
      // Single: top bracket starts at $640,600
      // Taxable = $715,750 - $16,100 = $699,650
      const inputs = createDefaultInputs({
        federalIncome: 715750,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(699650);
      // Verify some income is taxed at 37%
      const topBracket = result.ordinaryIncomeBracketBreakdown.find(
        (b) => b.rate === 0.37,
      );
      expect(topBracket).toBeDefined();
      expect(topBracket!.incomeInBracket).toBe(699650 - 640600); // $59,050
    });

    it("handles zero taxable income correctly", () => {
      // Income below standard deduction ($16,100)
      const inputs = createDefaultInputs({
        federalIncome: 15750,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
    });
  });

  describe("FICA edge cases", () => {
    it("handles wages exactly at SS cap", () => {
      const inputs = createDefaultInputs({
        federalIncome: 168600,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.ficaBreakdown!.socialSecurityWages).toBe(168600);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(
        168600 * 0.062,
        2,
      );
      // No additional Medicare (under $200k threshold)
      expect(result.ficaBreakdown!.additionalMedicareTax).toBe(0);
    });

    it("applies lower Medicare threshold for MFS ($125k)", () => {
      // MFS threshold is $125,000 vs $200,000 for single
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Additional Medicare on $25,000 ($150k - $125k)
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(
        25000 * 0.009,
        2,
      );
    });

    it("uses higher Medicare threshold for MFJ ($250k)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 240000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Under $250k threshold, no additional Medicare
      expect(result.ficaBreakdown!.additionalMedicareTax).toBe(0);
    });
  });

  describe("LTCG with 20% bracket", () => {
    it("applies 20% rate for very high LTCG", () => {
      // Single: 20% bracket starts at $545,500
      const inputs = createDefaultInputs({
        longTermCapitalGains: 600000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      // Verify some LTCG taxed at 20%
      const top20Bracket = result.ltcgBracketBreakdown.find(
        (b) => b.rate === 0.2,
      );
      expect(top20Bracket).toBeDefined();
      // Taxable LTCG = $600,000 - $16,100 std = $583,900
      expect(top20Bracket!.incomeInBracket).toBe(583900 - 545500);
    });
  });

  describe("refund and remaining owed calculations", () => {
    it("calculates refund when overpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        federalTaxWithheld: 10000,
        federalEstimatedPaid: 5000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.totalPaid).toBe(15000);
      // Tax should be less than $15k, so refund expected
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it("calculates remaining owed when underpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        federalTaxWithheld: 10000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.totalPaid).toBe(10000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles zero income with capital gains only", () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.wageIncome).toBe(0);
      expect(result.grossIncome).toBe(50000);
      // LTCG should be taxed at 0% for first portion
      expect(result.ltcgTax).toBeGreaterThanOrEqual(0);
    });

    it("handles FICA with zero wages", () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // FICA only applies to wages, not capital gains
      expect(result.ficaBreakdown?.totalFica).toBe(0);
    });

    it("handles all inputs at zero", () => {
      const inputs = createDefaultInputs();

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
      );

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe("interest and dividends", () => {
    const calculate = (overrides: Parameters<typeof createDefaultInputs>[0]) =>
      calculateFederalTax(
        createDefaultInputs({ filingStatus: "single", ...overrides }),
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

    it("taxes qualified dividends at LTCG rates and the rest as ordinary income", () => {
      // $100,000 wages + $20,000 dividends, of which $15,000 qualified
      const result = calculate({
        federalIncome: 100000,
        ordinaryDividends: 20000,
        qualifiedDividends: 15000,
      });

      expect(result.grossIncome).toBe(120000);
      // $100,000 + $5,000 non-qualified - $16,100 std
      expect(result.taxableOrdinaryIncome).toBe(88900);
      expect(result.taxableLTCG).toBe(15000);
      // Ordinary income fills the 0% bracket, so all $15,000 at 15%
      expect(result.ltcgTax).toBeCloseTo(2250, 2);
    });

    it("does not charge FICA on dividends", () => {
      const withDividends = calculate({
        federalIncome: 100000,
        ordinaryDividends: 50000,
      });
      const withoutDividends = calculate({ federalIncome: 100000 });

      expect(withDividends.ficaBreakdown!.totalFica).toBe(
        withoutDividends.ficaBreakdown!.totalFica,
      );
    });

    it("includes dividends in net investment income", () => {
      // $250k wages + $50k dividends = $300k MAGI, $100k over threshold
      // NIIT = 3.8% x min($50k, $100k) = $1,900
      const result = calculate({
        federalIncome: 250000,
        ordinaryDividends: 50000,
        qualifiedDividends: 50000,
      });

      expect(result.niitBreakdown!.netInvestmentIncome).toBe(50000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(1900, 2);
    });

    it("does not offset dividends with loss carryovers beyond $3,000", () => {
      const result = calculate({
        federalIncome: 100000,
        ordinaryDividends: 50000,
        qualifiedDividends: 50000,
        priorYearLongTermLossCarryover: 100000,
      });

      expect(result.longTermLossCarryoverOffset).toBe(3000);
      expect(result.longTermLossCarryoverUnused).toBe(97000);
      expect(result.taxableLTCG).toBe(50000);
      // $100,000 - $3,000 - $16,100 std
      expect(result.taxableOrdinaryIncome).toBe(80900);
    });

    it("taxes interest as ordinary investment income without FICA", () => {
      // $250k wages + $50k interest = $300k MAGI, $100k over threshold
      const result = calculate({
        federalIncome: 250000,
        interestIncome: 50000,
      });
      const withoutInterest = calculate({ federalIncome: 250000 });

      expect(result.grossIncome).toBe(300000);
      // $250,000 + $50,000 - $16,100 std
      expect(result.taxableOrdinaryIncome).toBe(283900);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ficaBreakdown!.totalFica).toBe(
        withoutInterest.ficaBreakdown!.totalFica,
      );
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(50000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(1900, 2);
    });

    it("limits qualified dividends to ordinary dividends", () => {
      const result = calculate({
        federalIncome: 100000,
        ordinaryDividends: 10000,
        qualifiedDividends: 25000,
      });

      expect(result.qualifiedDividends).toBe(10000);
      expect(result.taxableLTCG).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(83900);
    });

    it("applies excess deductions to qualified dividends", () => {
      // No ordinary income, so the $16,100 std deduction reduces dividends
      const result = calculate({
        ordinaryDividends: 40000,
        qualifiedDividends: 40000,
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(23900);
      expect(result.ltcgTax).toBe(0);
    });

    it("handles raw sales, carryovers, and dividends together", () => {
      // ST: $30,000 gain - $20,000 carryover = $10,000 net gain
      // LT: -$4,000 loss - $50,000 carryover = -$54,000 net loss
      // Net loss of $44,000: $3,000 deductible, $41,000 carries over
      const result = calculate({
        federalIncome: 200000,
        shortTermCapitalGains: 30000,
        longTermCapitalGains: -4000,
        ordinaryDividends: 150000,
        qualifiedDividends: 120000,
        priorYearShortTermLossCarryover: 20000,
        priorYearLongTermLossCarryover: 50000,
      });

      expect(result.shortTermLossCarryoverOffset).toBe(20000);
      expect(result.shortTermLossCarryoverUnused).toBe(0);
      expect(result.longTermLossCarryoverOffset).toBe(13000); // 10,000 + 3,000
      expect(result.longTermLossCarryoverUnused).toBe(41000);
      // Qualified dividends are untouched by the losses
      expect(result.taxableLTCG).toBe(120000);
      // $200,000 + $30,000 non-qualified - $3,000 - $16,100 std
      expect(result.taxableOrdinaryIncome).toBe(210900);
      // Net investment income = $150,000 dividends - $3,000 loss deduction
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(147000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(5586, 2);
    });
  });

  describe("Net Investment Income Tax (NIIT)", () => {
    it("applies 3.8% NIIT when MAGI exceeds threshold with capital gains", () => {
      // Single filer with $250k wages + $100k LTCG = $350k MAGI
      // Threshold: $200k, so $150k over threshold
      // Net investment income: $100k (LTCG only)
      // NIIT = 3.8% × min($100k, $150k) = $3,800
      const inputs = createDefaultInputs({
        federalIncome: 250000,
        longTermCapitalGains: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeDefined();
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(100000);
      expect(result.niitBreakdown!.magiOverThreshold).toBe(150000);
      expect(result.niitBreakdown!.taxableAmount).toBe(100000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(3800, 2);
    });

    it("does not apply NIIT when MAGI is under threshold", () => {
      // Single filer with $150k wages + $30k LTCG = $180k MAGI
      // Threshold: $200k, so under threshold = no NIIT
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        longTermCapitalGains: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeUndefined();
    });

    it("uses MAGI over threshold when less than net investment income", () => {
      // Single filer with $210k wages + $50k LTCG = $260k MAGI
      // Threshold: $200k, so $60k over threshold
      // Net investment income: $50k
      // NIIT = 3.8% × min($50k, $60k) = 3.8% × $50k = $1,900
      const inputs = createDefaultInputs({
        federalIncome: 210000,
        longTermCapitalGains: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeDefined();
      expect(result.niitBreakdown!.taxableAmount).toBe(50000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(1900, 2);
    });

    it("uses lower threshold for MFS ($125k)", () => {
      // MFS with $150k wages + $50k LTCG = $200k MAGI
      // Threshold: $125k, so $75k over threshold
      // Net investment income: $50k
      // NIIT = 3.8% × min($50k, $75k) = $1,900
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        longTermCapitalGains: 50000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeDefined();
      expect(result.niitBreakdown!.magiOverThreshold).toBe(75000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(1900, 2);
    });

    it("uses higher threshold for MFJ ($250k)", () => {
      // MFJ with $260k wages + $50k LTCG = $310k MAGI
      // Threshold: $250k, so $60k over threshold
      // Net investment income: $50k
      // NIIT = 3.8% × min($50k, $60k) = $1,900
      const inputs = createDefaultInputs({
        federalIncome: 260000,
        longTermCapitalGains: 50000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeDefined();
      expect(result.niitBreakdown!.magiOverThreshold).toBe(60000);
      expect(result.niitBreakdown!.taxableAmount).toBe(50000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(1900, 2);
    });

    it("reduces net investment income by capital loss carryover", () => {
      // Single with $300k wages + $100k LTCG - $30k LT loss carryover
      // Net investment income = $100k - $30k = $70k
      // MAGI = $300k + $100k - $30k = $370k, over threshold by $170k
      // NIIT = 3.8% × min($70k, $170k) = 3.8% × $70k = $2,660
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        longTermCapitalGains: 100000,
        priorYearLongTermLossCarryover: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeDefined();
      // Net investment income is reduced by carryover
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(70000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(2660, 2);
    });

    it("includes both STCG and LTCG in net investment income", () => {
      // Single with $250k wages + $30k STCG + $70k LTCG = $350k MAGI
      // Net investment income = $30k + $70k = $100k
      // NIIT = 3.8% × min($100k, $150k) = $3,800
      const inputs = createDefaultInputs({
        federalIncome: 250000,
        shortTermCapitalGains: 30000,
        longTermCapitalGains: 70000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.niitBreakdown).toBeDefined();
      expect(result.niitBreakdown!.netInvestmentIncome).toBe(100000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(3800, 2);
    });

    it("NIIT is included in total tax calculation", () => {
      const inputs = createDefaultInputs({
        federalIncome: 250000,
        longTermCapitalGains: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Total tax should include NIIT
      const expectedNiit = result.niitBreakdown!.tax;
      const taxWithoutNiit =
        result.ordinaryIncomeTax +
        result.ltcgTax +
        (result.ficaBreakdown?.totalFica ?? 0);
      expect(result.totalTax).toBeCloseTo(taxWithoutNiit + expectedNiit, 2);
    });
  });

  describe("Self-Employment Tax", () => {
    it("calculates SE tax on self-employment income", () => {
      // $100,000 SE income
      // Net earnings = $100,000 * 0.9235 = $92,350
      // SS: $92,350 * 0.124 = $11,451.40
      // Medicare: $92,350 * 0.029 = $2,678.15
      // Total SE tax = $14,129.55
      // Deductible half = $7,064.78
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.selfEmploymentTaxBreakdown).toBeDefined();
      expect(result.selfEmploymentTaxBreakdown!.netEarnings).toBeCloseTo(
        92350,
        0,
      );
      expect(result.selfEmploymentTaxBreakdown!.socialSecurityTax).toBeCloseTo(
        11451.4,
        2,
      );
      expect(result.selfEmploymentTaxBreakdown!.medicareTax).toBeCloseTo(
        2678.15,
        2,
      );
      expect(result.selfEmploymentTaxBreakdown!.totalSETax).toBeCloseTo(
        14129.55,
        2,
      );
      expect(result.selfEmploymentTaxBreakdown!.deductibleHalf).toBeCloseTo(
        7064.78,
        1,
      );
    });

    it("respects SS wage base cap when combined with W-2 wages", () => {
      // $100,000 W-2 wages + $100,000 SE income
      // W-2 uses $100,000 of $184,500 SS cap, leaving $84,500 room
      // SE net earnings = $92,350
      // Only $84,500 subject to SS (capped)
      // SS: $84,500 * 0.124 = $10,478
      // Medicare: $92,350 * 0.029 = $2,678.15 (all earnings)
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.selfEmploymentTaxBreakdown).toBeDefined();
      expect(result.selfEmploymentTaxBreakdown!.socialSecurityTax).toBeCloseTo(
        10478,
        2,
      );
      expect(result.selfEmploymentTaxBreakdown!.medicareTax).toBeCloseTo(
        2678.15,
        2,
      );
    });

    it("deductible half reduces taxable income", () => {
      // $100,000 SE income with deductible half of ~$7,065
      // Taxable = $100,000 - $7,065 - $16,100 std = $76,835 (before QBI)
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // After SE deduction and standard deduction, but before QBI
      const expectedTaxableBeforeQbi =
        100000 - result.selfEmploymentTaxBreakdown!.deductibleHalf - 16100;
      // After QBI (20% of SE income, limited to 20% of taxable)
      const expectedQbi = Math.min(
        100000 * 0.2,
        expectedTaxableBeforeQbi * 0.2,
      );
      const expectedTaxable = expectedTaxableBeforeQbi - expectedQbi;

      expect(result.taxableOrdinaryIncome).toBeCloseTo(expectedTaxable, 0);
    });

    it("SE income is included in gross income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        selfEmploymentIncome: 30000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.grossIncome).toBe(80000);
    });

    it("SE tax is included in total tax", () => {
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      const expectedTotal =
        result.ordinaryIncomeTax +
        result.selfEmploymentTaxBreakdown!.totalSETax;
      expect(result.totalTax).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe("QBI Deduction", () => {
    it("calculates 20% QBI deduction for self-employment income", () => {
      // $100,000 SE income, under phaseout threshold
      // QBI = 20% of $100,000 = $20,000
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction).toBeDefined();
      expect(result.qbiDeduction!.qualifiedBusinessIncome).toBe(100000);
      expect(result.qbiDeduction!.tentativeDeduction).toBe(20000);
      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);
    });

    it("limits QBI to 20% of taxable income", () => {
      // $50,000 SE income, high deductions limit taxable income
      // If taxable income before QBI is $20,000, QBI limited to $4,000
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 50000,
        contributions401k: 23500, // high deductions
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction).toBeDefined();
      // QBI should be limited by 20% of taxable income
      const taxableBeforeQbi =
        50000 -
        result.selfEmploymentTaxBreakdown!.deductibleHalf -
        23500 -
        16100;
      const expectedQbi = Math.min(50000 * 0.2, taxableBeforeQbi * 0.2);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(expectedQbi, 0);
    });

    it("phases out QBI for high income single filer", () => {
      // $400,000 SE income, taxable well above $201,750 threshold
      // Phaseout range is $75,000 for single
      // At $276,750+, QBI is fully phased out
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 400000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction).toBeDefined();
      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      // Should be significantly reduced or zero
      expect(result.qbiDeduction!.finalDeduction).toBeLessThan(
        result.qbiDeduction!.tentativeDeduction,
      );
    });

    it("uses higher phaseout threshold for MFJ", () => {
      // $300,000 SE income for MFJ - under $403,500 threshold
      // Should get full QBI without phaseout
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 300000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction).toBeDefined();
      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);
    });

    it("QBI reduces taxable income and tax", () => {
      const inputsWithSE = createDefaultInputs({
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      const resultWithSE = calculateFederalTax(
        inputsWithSE,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Compare taxable income with and without QBI effect
      // AGI should reflect QBI deduction
      expect(resultWithSE.qbiDeduction!.finalDeduction).toBeGreaterThan(0);
      expect(resultWithSE.adjustedGrossIncome).toBeLessThan(
        100000 -
          resultWithSE.selfEmploymentTaxBreakdown!.deductibleHalf -
          16100,
      );
    });

    it("no QBI when no self-employment income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction).toBeUndefined();
    });
  });

  describe("golden integration tests", () => {
    it("calculates realistic $200k return with W-2, LTCG, and 401k - exact calculation", () => {
      // Inputs:
      // - $150,000 W-2 wages
      // - $50,000 LTCG
      // - $23,500 401k contribution
      // - Single filer
      //
      // Expected (calculated manually):
      // Gross income: $150,000 + $50,000 = $200,000
      //
      // Taxable ordinary income:
      // $150,000 - $23,500 (401k) - $16,100 (std ded) = $110,400
      //
      // Ordinary income tax (2026 single brackets):
      // $12,400 @ 10% = $1,240.00
      // $38,000 ($50,400 - $12,400) @ 12% = $4,560.00
      // $55,300 ($105,700 - $50,400) @ 22% = $12,166.00
      // $4,700 ($110,400 - $105,700) @ 24% = $1,128.00
      // Total ordinary tax = $19,094
      //
      // LTCG stacking:
      // Ordinary fills $110,400 (well above $49,450 threshold)
      // All $50,000 LTCG taxed at 15%
      // LTCG tax = $50,000 × 0.15 = $7,500
      //
      // FICA:
      // SS: $150,000 × 6.2% = $9,300
      // Medicare: $150,000 × 1.45% = $2,175
      // Total FICA = $11,475
      //
      // NIIT:
      // MAGI = $200,000, threshold = $200,000
      // Not over threshold = $0 NIIT
      //
      // Total tax = $19,094 + $7,500 + $11,475 = $38,069
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        longTermCapitalGains: 50000,
        contributions401k: 23500,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Verify each component
      expect(result.grossIncome).toBe(200000);
      expect(result.taxableOrdinaryIncome).toBe(110400);
      expect(result.ordinaryIncomeTax).toBe(19094);

      expect(result.taxableLTCG).toBe(50000);
      expect(result.ltcgTax).toBe(7500);

      expect(result.ficaBreakdown!.socialSecurityTax).toBe(9300);
      expect(result.ficaBreakdown!.medicareTax).toBe(2175);
      expect(result.ficaBreakdown!.totalFica).toBe(11475);

      // No NIIT (exactly at threshold, not over)
      expect(result.niitBreakdown).toBeUndefined();

      // Final total
      expect(result.totalTax).toBe(38069);
    });

    it("calculates high-income return with NIIT - exact calculation", () => {
      // Inputs:
      // - $300,000 W-2 wages
      // - $100,000 LTCG
      // - Single filer
      //
      // Expected:
      // Gross income: $400,000
      // Taxable ordinary: $300,000 - $16,100 = $283,900
      //
      // Ordinary income tax (2026 single brackets):
      // $12,400 @ 10% = $1,240.00
      // $38,000 @ 12% = $4,560.00
      // $55,300 @ 22% = $12,166.00
      // $96,075 @ 24% = $23,058.00
      // $54,450 @ 32% = $17,424.00
      // $27,675 @ 35% = $9,686.25
      // Total ordinary tax = $68,134.25
      //
      // LTCG: All at 15% (ordinary exceeds 0% threshold)
      // LTCG tax = $100,000 × 0.15 = $15,000
      //
      // FICA:
      // SS: $184,500 × 6.2% = $11,439 (capped at wage base)
      // Medicare: $300,000 × 1.45% = $4,350
      // Additional Medicare: ($300,000 - $200,000) × 0.9% = $900
      // Total FICA = $16,689
      //
      // NIIT:
      // MAGI = $400,000, over threshold by $200,000
      // Net investment income = $100,000
      // NIIT = min($100,000, $200,000) × 3.8% = $3,800
      //
      // Total tax = $68,134.25 + $15,000 + $16,689 + $3,800 = $103,623.25
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        longTermCapitalGains: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.grossIncome).toBe(400000);
      expect(result.taxableOrdinaryIncome).toBe(283900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(68134.25, 2);

      expect(result.taxableLTCG).toBe(100000);
      expect(result.ltcgTax).toBe(15000);

      expect(result.ficaBreakdown!.socialSecurityWages).toBe(184500);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(11439, 2);
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(900, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(16689, 2);

      expect(result.niitBreakdown!.netInvestmentIncome).toBe(100000);
      expect(result.niitBreakdown!.tax).toBe(3800);

      expect(result.totalTax).toBeCloseTo(103623.25, 2);
    });

    it("calculates investment-heavy return with losses and carryovers - exact calculation", () => {
      // Inputs:
      // - $180,000 W-2 wages
      // - $10,000 interest
      // - $150,000 ordinary dividends, of which $120,000 qualified
      // - $30,000 short-term gain, -$4,000 long-term loss
      // - $20,000 short-term and $50,000 long-term loss carryovers
      // - Single filer
      //
      // Schedule D netting:
      // Short-term: $30,000 - $20,000 = $10,000 net gain
      // Long-term: -$4,000 - $50,000 = -$54,000 net loss
      // Combined: -$44,000 net loss, $3,000 deductible, $41,000 carries over
      // Long-term loss used: $10,000 (ST gain) + $3,000 (deduction) = $13,000
      //
      // Gross income: $180,000 + $10,000 + $150,000 + $30,000 = $370,000
      // Taxable ordinary: $180,000 + $10,000 + $30,000 - $3,000 - $16,100
      //   = $200,900
      //
      // Ordinary income tax (2026 single brackets):
      // $12,400 @ 10% = $1,240.00
      // $38,000 @ 12% = $4,560.00
      // $55,300 @ 22% = $12,166.00
      // $95,200 @ 24% = $22,848.00
      // Total ordinary tax = $40,814.00
      //
      // Qualified dividends: $120,000 stacked from $200,900 to $320,900,
      // all at 15% (above $49,450, below $545,500) = $18,000
      //
      // FICA (wages only):
      // SS: $180,000 x 6.2% = $11,160
      // Medicare: $180,000 x 1.45% = $2,610
      // Total FICA = $13,770
      //
      // NIIT:
      // MAGI = $370,000 - $33,000 loss offsets = $337,000, over by $137,000
      // Net investment income = $10,000 + $150,000 - $3,000 = $157,000
      // NIIT = min($157,000, $137,000) x 3.8% = $5,206
      //
      // Total tax = $40,814 + $18,000 + $13,770 + $5,206 = $77,790
      const inputs = createDefaultInputs({
        federalIncome: 180000,
        interestIncome: 10000,
        ordinaryDividends: 150000,
        qualifiedDividends: 120000,
        shortTermCapitalGains: 30000,
        longTermCapitalGains: -4000,
        priorYearShortTermLossCarryover: 20000,
        priorYearLongTermLossCarryover: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.grossIncome).toBe(370000);
      expect(result.shortTermLossCarryoverOffset).toBe(20000);
      expect(result.shortTermLossCarryoverUnused).toBe(0);
      expect(result.longTermLossCarryoverOffset).toBe(13000);
      expect(result.longTermLossCarryoverUnused).toBe(41000);

      expect(result.taxableOrdinaryIncome).toBe(200900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(40814, 2);

      expect(result.taxableLTCG).toBe(120000);
      expect(result.ltcgTax).toBeCloseTo(18000, 2);

      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(13770, 2);

      expect(result.niitBreakdown!.netInvestmentIncome).toBe(157000);
      expect(result.niitBreakdown!.magiOverThreshold).toBe(137000);
      expect(result.niitBreakdown!.tax).toBeCloseTo(5206, 2);

      expect(result.totalTax).toBeCloseTo(77790, 2);
    });

    it("calculates SE income return with QBI - exact calculation", () => {
      // Inputs:
      // - $100,000 self-employment income
      // - Single filer, under QBI phaseout threshold
      //
      // Expected:
      // SE net earnings: $100,000 × 0.9235 = $92,350
      // SE tax: SS ($92,350 × 0.124) + Medicare ($92,350 × 0.029)
      //       = $11,451.40 + $2,678.15 = $14,129.55
      // Deductible half: $7,064.78
      //
      // Taxable before QBI: $100,000 - $7,064.78 - $16,100 = $76,835.22
      //
      // QBI tentative: $100,000 × 20% = $20,000
      // 20% of taxable limit: $76,835.22 × 20% = $15,367.04
      // Final QBI = min($20,000, $15,367.04) = $15,367.04
      //
      // Taxable ordinary: $76,835.22 - $15,367.04 = $61,468.18
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.grossIncome).toBe(100000);
      expect(result.selfEmploymentTaxBreakdown!.netEarnings).toBeCloseTo(
        92350,
        0,
      );
      expect(result.selfEmploymentTaxBreakdown!.totalSETax).toBeCloseTo(
        14129.55,
        2,
      );
      expect(result.selfEmploymentTaxBreakdown!.deductibleHalf).toBeCloseTo(
        7064.78,
        1,
      );

      expect(result.qbiDeduction!.qualifiedBusinessIncome).toBe(100000);
      expect(result.qbiDeduction!.tentativeDeduction).toBe(20000);
      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);
      // QBI limited by 20% of taxable income
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(15367, 0);
    });
  });

  describe("QBI phaseout exact verification", () => {
    it("calculates partial phaseout with exact math", () => {
      // Single filer with taxable income in phaseout range ($201,750 - $276,750)
      // Using $300,000 SE income:
      // SE net earnings: $300,000 × 0.9235 = $277,050
      // SE SS: $184,500 × 0.124 = $22,878 (capped at wage base)
      // SE Medicare: $277,050 × 0.029 = $8,034.45
      // Total SE tax: $30,912.45
      // Deductible half: $15,456.23
      //
      // Taxable before QBI: $300,000 - $15,456.23 - $16,100 = $268,443.77
      //
      // Phaseout calculation:
      // Excess over $201,750: $268,443.77 - $201,750 = $66,693.77
      // Phaseout ratio: $66,693.77 / $75,000 = 0.88925
      //
      // Tentative QBI: $300,000 × 20% = $60,000
      // Taxable income limit: $268,443.77 × 20% = $53,688.75
      // Final QBI: $53,688.75 × (1 - 0.88925) = $5,946.01
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 300000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(5946.01, 1);
    });

    it("fully phases out QBI above the phaseout range", () => {
      // $400,000 SE income: taxable before QBI is well above $276,750
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 400000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      expect(result.qbiDeduction!.finalDeduction).toBe(0);
    });

    it("counts qualified dividends toward the phaseout threshold", () => {
      // Single filer, $100,000 SE income + $300,000 qualified dividends
      // Deductible half of SE tax: $7,064.78
      // Taxable ordinary before QBI: $100,000 - $7,064.78 - $16,100 = $76,835.22
      // Total taxable before QBI: $376,835.22, above the full phaseout
      // point of $276,750, so QBI is fully phased out
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 100000,
        ordinaryDividends: 300000,
        qualifiedDividends: 300000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      expect(result.qbiDeduction!.finalDeduction).toBe(0);
      expect(result.taxableOrdinaryIncome).toBeCloseTo(76835.22, 1);
    });

    it("excludes qualified dividends from the 20% taxable income limit", () => {
      // Single filer, $100,000 SE income + $50,000 qualified dividends
      // Total taxable before QBI: $126,835.22, under the $201,750 threshold
      // Limit: 20% x $76,835.22 ordinary taxable income = $15,367.04
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 100000,
        ordinaryDividends: 50000,
        qualifiedDividends: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(15367.04, 1);
    });

    it("calculates QBI at start of phaseout range", () => {
      // To land exactly in phaseout, need taxable around $210,000
      // Using $50,000 SE + $175,000 W-2
      //
      // SE net: $50,000 × 0.9235 = $46,175
      // W-2 uses $175,000 of $184,500 SS cap, leaving $9,500 room
      // SE SS: $9,500 × 0.124 = $1,178
      // SE Medicare: $46,175 × 0.029 = $1,339.08
      // Total SE tax: $2,517.08
      // Deductible half: $1,258.54
      //
      // Taxable before QBI: $175,000 + $50,000 - $1,258.54 - $16,100 = $207,641.46
      //
      // Phaseout calculation:
      // Excess over $201,750: $207,641.46 - $201,750 = $5,891.46
      // Phaseout ratio: $5,891.46 / $75,000 = 0.07855
      // Reduction = 7.86%
      //
      // Tentative QBI: $50,000 × 20% = $10,000
      // Final QBI: $10,000 × (1 - 0.07855) = $9,214.47
      const inputs = createDefaultInputs({
        federalIncome: 175000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction!.tentativeDeduction).toBe(10000);
      expect(result.qbiDeduction!.phaseoutApplied).toBe(true);
      // Verify partial phaseout (not zero, not full)
      expect(result.qbiDeduction!.finalDeduction).toBeGreaterThan(0);
      expect(result.qbiDeduction!.finalDeduction).toBeLessThan(10000);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(9214.47, 1);
    });

    it("uses higher phaseout range for MFJ ($403,500 - $553,500)", () => {
      // MFJ with $300,000 SE income - under MFJ threshold
      // SE calculations same as before
      // Taxable before QBI: $300,000 - $15,456.23 - $32,200 = $252,343.77
      // MFJ threshold is $403,500, so NO phaseout
      const inputs = createDefaultInputs({
        selfEmploymentIncome: 300000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateFederalTax(
        inputs,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      expect(result.qbiDeduction!.phaseoutApplied).toBe(false);
      // Full QBI (limited by 20% of taxable income)
      expect(result.qbiDeduction!.finalDeduction).toBeGreaterThan(0);
    });
  });
});

describe.each(SUPPORTED_YEARS)(
  "calculateFederalTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("calculates basic bracket tax correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        data.federalBrackets,
        data.ltcgBrackets,
        data.federalDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.ficaData,
      );

      // Expected values differ by year due to bracket/deduction changes
      const expected = {
        "2025": { taxableIncome: 84250, tax: 13449 },
        "2026": { taxableIncome: 83900, tax: 13170 }, // Recalculated with 2026 brackets
      };

      expect(result.taxableOrdinaryIncome).toBe(expected[year].taxableIncome);
      expect(result.ordinaryIncomeTax).toBe(expected[year].tax);
    });

    it("caps Social Security at wage base", () => {
      const inputs = createDefaultInputs({
        federalIncome: 250000,
        filingStatus: "single",
      });

      const result = calculateFederalTax(
        inputs,
        data.federalBrackets,
        data.ltcgBrackets,
        data.federalDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.ficaData,
      );

      // SS wage base differs by year
      const expectedSsWageBase = {
        "2025": 176100,
        "2026": 184500,
      };

      expect(result.ficaBreakdown).toBeDefined();
      expect(result.ficaBreakdown!.socialSecurityWages).toBe(
        expectedSsWageBase[year],
      );
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(
        expectedSsWageBase[year] * 0.062,
        2,
      );
    });
  },
);
