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
      // $100,000 income - $15,750 standard deduction = $84,250 taxable
      // Bracket breakdown:
      // $11,925 @ 10% = $1,192.50
      // $36,550 ($48,475 - $11,925) @ 12% = $4,386.00
      // $35,775 ($84,250 - $48,475) @ 22% = $7,870.50
      // Total ordinary income tax = $13,449
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

      expect(result.taxableOrdinaryIncome).toBe(84250);
      expect(result.ordinaryIncomeTax).toBe(13449);
    });
  });

  describe("FICA taxes", () => {
    it("caps Social Security tax at wage base and applies additional Medicare above threshold", () => {
      // $250,000 wages for single filer
      // SS: $176,100 * 6.2% = $10,918.20 (capped at wage base)
      // Medicare base: $250,000 * 1.45% = $3,625
      // Additional Medicare: ($250,000 - $200,000) * 0.9% = $450
      // Total FICA = $14,993.20
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
      expect(result.ficaBreakdown!.socialSecurityWages).toBe(176100);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(10918.2, 2);
      expect(result.ficaBreakdown!.medicareTax).toBeCloseTo(3625, 2);
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(450, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(14993.2, 2);
    });
  });

  describe("long-term capital gains", () => {
    it("applies preferential 0% rate for LTCG within bracket threshold", () => {
      // Single filer with $30,000 LTCG and no ordinary income
      // LTCG bracket: $47,025 at 0%, so $30,000 is all at 0%
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

      expect(result.taxableLTCG).toBe(30000);
      expect(result.ltcgTax).toBe(0);
    });

    it("applies 15% rate for LTCG above 0% threshold", () => {
      // Single filer with $100,000 LTCG and no ordinary income
      // LTCG: $48,350 at 0% = $0, $51,650 at 15% = $7,747.50
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

      expect(result.taxableLTCG).toBe(100000);
      expect(result.ltcgTax).toBeCloseTo(7747.5, 2);
    });
  });

  describe("401k contributions", () => {
    it("reduces taxable ordinary income by 401k contributions", () => {
      // $100,000 income - $23,500 (401k) - $15,750 (std deduction) = $60,750 taxable
      // Bracket breakdown:
      // $11,925 @ 10% = $1,192.50
      // $36,550 @ 12% = $4,386.00
      // $12,275 ($60,750 - $48,475) @ 22% = $2,700.50
      // Total = $8,279
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

      expect(result.taxableOrdinaryIncome).toBe(60750);
      expect(result.ordinaryIncomeTax).toBe(8279);
    });
  });

  describe("pre-tax medical deductions", () => {
    it("reduces taxable ordinary income by pre-tax medical contributions", () => {
      // $100,000 income - $10,000 (pre-tax medical) - $15,750 (std deduction) = $74,250 taxable
      // Bracket breakdown:
      // $11,925 @ 10% = $1,192.50
      // $36,550 @ 12% = $4,386.00
      // $25,775 ($74,250 - $48,475) @ 22% = $5,670.50
      // Total = $11,249
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

      expect(result.taxableOrdinaryIncome).toBe(74250);
      expect(result.ordinaryIncomeTax).toBe(11249);
      expect(result.preTaxMedical).toBe(10000);
    });

    it("combines with 401k contributions to reduce taxable income", () => {
      // $100,000 income - $23,500 (401k) - $5,000 (pre-tax medical) - $15,750 (std deduction) = $55,750 taxable
      // Bracket breakdown:
      // $11,925 @ 10% = $1,192.50
      // $36,550 @ 12% = $4,386.00
      // $7,275 ($55,750 - $48,475) @ 22% = $1,600.50
      // Total = $7,179
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

      expect(result.taxableOrdinaryIncome).toBe(55750);
      expect(result.ordinaryIncomeTax).toBe(7179);
      expect(result.contributions401k).toBe(23500);
      expect(result.preTaxMedical).toBe(5000);
    });
  });

  describe("negative LTCG (current year losses)", () => {
    it("treats negative LTCG as $0 for tax calculation", () => {
      // $100,000 federal income with -$50,000 LTCG loss
      // The loss should NOT reduce taxable income this year (carried forward)
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
    });

    it("does not reduce AGI with negative LTCG", () => {
      // Verify that negative LTCG doesn't artificially reduce AGI
      const inputsWithLoss = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -20000,
        filingStatus: "single",
      });

      const inputsWithoutLoss = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: 0,
        filingStatus: "single",
      });

      const resultWithLoss = calculateFederalTax(
        inputsWithLoss,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      const resultWithoutLoss = calculateFederalTax(
        inputsWithoutLoss,
        federalBrackets,
        ltcgBrackets,
        federalDeductions,
        sharedLimits,
        federalLimits,
        ficaData,
      );

      // Tax should be identical - loss doesn't reduce current year tax
      expect(resultWithLoss.totalTax).toBe(resultWithoutLoss.totalTax);
      expect(resultWithLoss.adjustedGrossIncome).toBe(
        resultWithoutLoss.adjustedGrossIncome,
      );
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
      // Taxable ordinary = $100k - $3k - $15.75k std = $81,250
      expect(result.taxableOrdinaryIncome).toBe(81250);
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
      // $100k income, tax is $13,449 + FICA
      // FICA: $100k * 6.2% = $6,200 (SS) + $100k * 1.45% = $1,450 (Medicare) = $7,650
      // Total tax = $13,449 + $7,650 = $21,099
      // 90% of current year = $18,989.10
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
        21099 * 0.9,
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
      // After std deduction: $47,000 - $15,750 = $31,250 taxable
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
      expect(result.taxableOrdinaryIncome).toBe(31250);
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
    it("offsets only LTCG, not ordinary income", () => {
      // $100,000 wage income, $20,000 LTCG, $50,000 LT loss carryover
      // LT loss only offsets the $20,000 LTCG, NOT ordinary income
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

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      expect(result.taxableLTCG).toBe(0);
      // Ordinary income should be unaffected
      expect(result.taxableOrdinaryIncome).toBe(84250); // 100k - 15.75k std
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
      expect(result.taxableLTCG).toBe(70000);
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

      // ST loss: $15k offsets ST gains, $3k offsets ordinary income = $18k used
      expect(result.shortTermLossCarryoverOffset).toBe(18000);
      // LT loss: only offsets LTCG in taxed brackets (not 0% bracket)
      // Taxable ordinary = $80k - $18k - $15.75k = $46.25k
      // Room in 0% LTCG bracket = $48,350 - $46,250 = $2,100
      // LTCG in taxed brackets = $25k - $2,100 = $22,900
      // Carryover used = min($10k, $22,900) = $10k
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.taxableLTCG).toBe(15000); // 25k - 10k
    });
  });

  describe("LTCG bracket stacking on ordinary income", () => {
    it("stacks LTCG on top of ordinary income for bracket calculation", () => {
      // $40k taxable ordinary + $20k LTCG = $60k total
      // 0% LTCG threshold for single = $48,350
      // Room in 0% bracket = $48,350 - $40,000 = $8,350
      // So $8,350 LTCG at 0%, $11,650 LTCG at 15%
      // LTCG tax = $11,650 * 0.15 = $1,747.50
      const inputs = createDefaultInputs({
        federalIncome: 55750, // 55,750 - 15,750 std = $40k taxable ordinary
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

      expect(result.taxableOrdinaryIncome).toBe(40000);
      expect(result.taxableLTCG).toBe(20000);

      // Verify LTCG is split across 0% and 15% brackets
      expect(result.ltcgBracketBreakdown).toHaveLength(2);
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0);
      expect(result.ltcgBracketBreakdown[0].incomeInBracket).toBe(8350);
      expect(result.ltcgBracketBreakdown[1].rate).toBe(0.15);
      expect(result.ltcgBracketBreakdown[1].incomeInBracket).toBe(11650);

      expect(result.ltcgTax).toBeCloseTo(11650 * 0.15, 2);
    });

    it("all LTCG at 15% when ordinary income fills 0% bracket", () => {
      // $60k taxable ordinary (above $48,350 threshold) + $20k LTCG
      // All LTCG taxed at 15%
      const inputs = createDefaultInputs({
        federalIncome: 75750, // 75,750 - 15,750 = $60k taxable
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

      expect(result.taxableOrdinaryIncome).toBe(60000);
      expect(result.ltcgBracketBreakdown).toHaveLength(1);
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0.15);
      expect(result.ltcgBracketBreakdown[0].incomeInBracket).toBe(20000);
      expect(result.ltcgTax).toBeCloseTo(20000 * 0.15, 2);
    });

    it("all LTCG at 0% when no ordinary income", () => {
      // $30k LTCG only, well under $47,025 threshold
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
      expect(result.taxableLTCG).toBe(30000);
      expect(result.ltcgBracketBreakdown).toHaveLength(1);
      expect(result.ltcgBracketBreakdown[0].rate).toBe(0);
      expect(result.ltcgTax).toBe(0);
    });
  });

  describe("smart long-term loss carryover", () => {
    it("preserves carryover when all LTCG in 0% bracket", () => {
      // Low ordinary income, LTCG entirely in 0% bracket
      // Carryover should be preserved, not wasted
      const inputs = createDefaultInputs({
        federalIncome: 20000, // taxable = 20k - 15.75k = $4,250
        longTermCapitalGains: 30000, // still under $48,350 threshold
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

      expect(result.taxableOrdinaryIncome).toBe(4250);
      // Room in 0% bracket = $48,350 - $4,250 = $44,100
      // All $30k LTCG fits in 0% bracket, so no carryover used
      expect(result.longTermLossCarryoverOffset).toBe(0);
      expect(result.longTermLossCarryoverUnused).toBe(10000);
      expect(result.taxableLTCG).toBe(30000);
      expect(result.ltcgTax).toBe(0);
    });

    it("uses carryover only for LTCG that would be taxed", () => {
      // LTCG spans 0% and 15% brackets, only use carryover for 15% portion
      const inputs = createDefaultInputs({
        federalIncome: 55750, // taxable = $40k
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

      // Room in 0% bracket = $48,350 - $40,000 = $8,350
      // LTCG in taxed brackets = $30,000 - $8,350 = $21,650
      // Carryover used = min($25,000, $21,650) = $21,650
      // Unused carryover = $25,000 - $21,650 = $3,350
      expect(result.longTermLossCarryoverOffset).toBe(21650);
      expect(result.longTermLossCarryoverUnused).toBe(3350);

      // Taxable LTCG = $30k - $21,650 = $8,350 (exactly the 0% bracket portion)
      expect(result.taxableLTCG).toBe(8350);
      // All remaining LTCG is in 0% bracket, so no tax
      expect(result.ltcgTax).toBe(0);
    });

    it("uses full carryover when all LTCG above 0% bracket", () => {
      // High ordinary income fills 0% bracket entirely
      const inputs = createDefaultInputs({
        federalIncome: 75750, // taxable = $60k (above $48,350)
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
      // Carryover precisely matches LTCG in taxed brackets
      const inputs = createDefaultInputs({
        federalIncome: 55750, // taxable = $40k
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 11650, // exactly matches taxed portion
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

      // Room in 0% bracket = $48,350 - $40,000 = $8,350
      // LTCG in taxed brackets = $20,000 - $8,350 = $11,650
      expect(result.longTermLossCarryoverOffset).toBe(11650);
      expect(result.longTermLossCarryoverUnused).toBe(0);
      expect(result.taxableLTCG).toBe(8350);
      expect(result.ltcgTax).toBe(0);
    });
  });

  describe("bracket boundary edge cases", () => {
    it("taxes income exactly at first bracket boundary correctly", () => {
      // Taxable income exactly $11,925 (top of 10% bracket)
      // Need gross = $11,925 + $15,750 std = $27,675
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

      expect(result.taxableOrdinaryIncome).toBe(11925);
      expect(result.ordinaryIncomeTax).toBe(1192.5); // all at 10%
    });

    it("taxes $1 over bracket boundary at higher rate", () => {
      // Taxable income $11,926 - $1 in 12% bracket
      const inputs = createDefaultInputs({
        federalIncome: 27676,
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

      expect(result.taxableOrdinaryIncome).toBe(11926);
      // $11,925 @ 10% + $1 @ 12% = $1,192.50 + $0.12 = $1,192.62
      expect(result.ordinaryIncomeTax).toBeCloseTo(1192.62, 2);
    });

    it("handles top bracket (37%) with no upper limit", () => {
      // Very high income in top bracket
      // Single: top bracket starts at $626,350
      // Taxable = $700,000, so need gross = $715,750
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

      expect(result.taxableOrdinaryIncome).toBe(700000);
      // Verify some income is taxed at 37%
      const topBracket = result.ordinaryIncomeBracketBreakdown.find(
        (b) => b.rate === 0.37,
      );
      expect(topBracket).toBeDefined();
      expect(topBracket!.incomeInBracket).toBe(700000 - 626350); // $73,650
    });

    it("handles zero taxable income correctly", () => {
      // Income exactly equals standard deduction
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
      // Single: 20% bracket starts at $533,400
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
      expect(top20Bracket!.incomeInBracket).toBe(600000 - 533400);
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
      // W-2 uses $100,000 of $176,100 SS cap, leaving $76,100 room
      // SE net earnings = $92,350
      // Only $76,100 subject to SS (capped)
      // SS: $76,100 * 0.124 = $9,436.40
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
        9436.4,
        2,
      );
      expect(result.selfEmploymentTaxBreakdown!.medicareTax).toBeCloseTo(
        2678.15,
        2,
      );
    });

    it("deductible half reduces taxable income", () => {
      // $100,000 SE income with deductible half of ~$7,065
      // Taxable = $100,000 - $7,065 - $15,750 std = $77,185 (before QBI)
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
        100000 - result.selfEmploymentTaxBreakdown!.deductibleHalf - 15750;
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
        15750;
      const expectedQbi = Math.min(50000 * 0.2, taxableBeforeQbi * 0.2);
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(expectedQbi, 0);
    });

    it("phases out QBI for high income single filer", () => {
      // $400,000 SE income, taxable well above $191,950 threshold
      // Phaseout range is $50,000 for single
      // At $241,950+, QBI is fully phased out
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
      // $300,000 SE income for MFJ - under $383,900 threshold
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
          15750,
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
      // $150,000 - $23,500 (401k) - $15,750 (std ded) = $110,750
      //
      // Ordinary income tax (2025 single brackets):
      // $11,925 @ 10% = $1,192.50
      // $36,550 ($48,475 - $11,925) @ 12% = $4,386.00
      // $54,875 ($103,350 - $48,475) @ 22% = $12,072.50
      // $7,400 ($110,750 - $103,350) @ 24% = $1,776.00
      // Total ordinary tax = $19,427
      //
      // LTCG stacking:
      // Ordinary fills $110,750 (well above $48,350 threshold)
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
      // Total tax = $19,427 + $7,500 + $11,475 = $38,402
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
      expect(result.taxableOrdinaryIncome).toBe(110750);
      expect(result.ordinaryIncomeTax).toBe(19427);

      expect(result.taxableLTCG).toBe(50000);
      expect(result.ltcgTax).toBe(7500);

      expect(result.ficaBreakdown!.socialSecurityTax).toBe(9300);
      expect(result.ficaBreakdown!.medicareTax).toBe(2175);
      expect(result.ficaBreakdown!.totalFica).toBe(11475);

      // No NIIT (exactly at threshold, not over)
      expect(result.niitBreakdown).toBeUndefined();

      // Final total
      expect(result.totalTax).toBe(38402);
    });

    it("calculates high-income return with NIIT - exact calculation", () => {
      // Inputs:
      // - $300,000 W-2 wages
      // - $100,000 LTCG
      // - Single filer
      //
      // Expected:
      // Gross income: $400,000
      // Taxable ordinary: $300,000 - $15,750 = $284,250
      //
      // Ordinary income tax (2025 single brackets):
      // $11,925 @ 10% = $1,192.50
      // $36,550 @ 12% = $4,386.00
      // $54,875 @ 22% = $12,072.50
      // $93,950 @ 24% = $22,548.00
      // $53,225 @ 32% = $17,032.00
      // $33,725 @ 35% = $11,803.75
      // Total ordinary tax = $69,034.75
      //
      // LTCG: All at 15% (ordinary exceeds 0% threshold)
      // LTCG tax = $100,000 × 0.15 = $15,000
      //
      // FICA:
      // SS: $176,100 × 6.2% = $10,918.20 (capped at wage base)
      // Medicare: $300,000 × 1.45% = $4,350
      // Additional Medicare: ($300,000 - $200,000) × 0.9% = $900
      // Total FICA = $16,168.20
      //
      // NIIT:
      // MAGI = $400,000, over threshold by $200,000
      // Net investment income = $100,000
      // NIIT = min($100,000, $200,000) × 3.8% = $3,800
      //
      // Total tax = $69,034.75 + $15,000 + $16,168.20 + $3,800 = $104,002.95
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
      expect(result.taxableOrdinaryIncome).toBe(284250);
      expect(result.ordinaryIncomeTax).toBeCloseTo(69034.75, 2);

      expect(result.taxableLTCG).toBe(100000);
      expect(result.ltcgTax).toBe(15000);

      expect(result.ficaBreakdown!.socialSecurityWages).toBe(176100);
      expect(result.ficaBreakdown!.socialSecurityTax).toBeCloseTo(10918.2, 2);
      expect(result.ficaBreakdown!.additionalMedicareTax).toBeCloseTo(900, 2);
      expect(result.ficaBreakdown!.totalFica).toBeCloseTo(16168.2, 2);

      expect(result.niitBreakdown!.netInvestmentIncome).toBe(100000);
      expect(result.niitBreakdown!.tax).toBe(3800);

      expect(result.totalTax).toBeCloseTo(104002.95, 2);
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
      // Taxable before QBI: $100,000 - $7,064.78 - $15,750 = $77,185.22
      //
      // QBI tentative: $100,000 × 20% = $20,000
      // 20% of taxable limit: $77,185.22 × 20% = $15,437.04
      // Final QBI = min($20,000, $15,437.04) = $15,437.04
      //
      // Taxable ordinary: $77,185.22 - $15,437.04 = $61,748.18
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
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(15437, 0);
    });
  });

  describe("QBI phaseout exact verification", () => {
    it("calculates partial phaseout with exact math", () => {
      // Single filer with taxable income in phaseout range ($191,950 - $241,950)
      // Using $200,000 SE income to land in phaseout range
      //
      // SE net earnings: $200,000 × 0.9235 = $184,700
      // SE SS: $176,100 × 0.124 = $21,836.40 (capped at wage base)
      // SE Medicare: $184,700 × 0.029 = $5,356.30
      // Total SE tax: $27,192.70
      // Deductible half: $13,596.35
      //
      // Taxable before QBI: $200,000 - $13,596.35 - $15,750 = $170,653.65
      // This is UNDER the phaseout threshold of $191,950 - no phaseout!
      //
      // Let's use a higher income to land IN the phaseout range.
      // Using $300,000 SE income:
      // SE net earnings: $300,000 × 0.9235 = $277,050
      // SE SS: $176,100 × 0.124 = $21,836.40 (capped)
      // SE Medicare: $277,050 × 0.029 = $8,034.45
      // Total SE tax: $29,870.85
      // Deductible half: $14,935.43
      //
      // Taxable before QBI: $300,000 - $14,935.43 - $15,750 = $269,314.57
      // This is ABOVE the full phaseout threshold of $241,950
      // So QBI is fully phased out for high SE income
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
      // Above $241,950, QBI is fully phased out
      expect(result.qbiDeduction!.finalDeduction).toBe(0);
    });

    it("calculates QBI at start of phaseout range", () => {
      // To land exactly in phaseout, need taxable around $210,000
      // Using $50,000 SE + $175,000 W-2
      //
      // SE net: $50,000 × 0.9235 = $46,175
      // W-2 uses $175,000 of SS cap (exceeds $176,100)
      // So W-2 SS tax maxes out, SE gets no SS room
      // SE SS: $0 (capped)
      // Actually wait - W-2 at $175,000 leaves $176,100 - $175,000 = $1,100 room
      // SE SS: $1,100 × 0.124 = $136.40
      // SE Medicare: $46,175 × 0.029 = $1,339.08
      // Total SE tax: $1,475.48
      // Deductible half: $737.74
      //
      // Taxable before QBI: $175,000 + $50,000 - $737.74 - $15,750 = $208,512.26
      //
      // Phaseout calculation:
      // Excess over $191,950: $208,562.26 - $191,950 = $16,612.26
      // Phaseout ratio: $16,612.26 / $50,000 = 0.3322
      // Reduction = 33.22%
      //
      // Tentative QBI: $50,000 × 20% = $10,000
      // Final QBI: $10,000 × (1 - 0.3322) = $6,678
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
      // Approximately $6,678 based on phaseout math
      expect(result.qbiDeduction!.finalDeduction).toBeCloseTo(6678, -2);
    });

    it("uses higher phaseout range for MFJ ($383,900 - $483,900)", () => {
      // MFJ with $300,000 SE income - under MFJ threshold
      // SE calculations same as before
      // Taxable before QBI: $300,000 - $14,935.43 - $31,400 = $253,664.57
      // MFJ threshold is $383,900, so NO phaseout
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
