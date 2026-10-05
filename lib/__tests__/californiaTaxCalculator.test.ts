import { describe, it, expect, beforeAll } from "vitest";
import { calculateCaliforniaTax } from "../states/californiaTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import {
  californiaBrackets,
  californiaDeductions,
  sharedLimits,
  californiaLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

describe("calculateCaliforniaTax", () => {
  describe("capital gains as ordinary income", () => {
    it("taxes both short-term and long-term capital gains at ordinary rates", () => {
      // Single filer with $50,000 LTCG and $50,000 STCG
      // Gross = $0 + $50,000 + $50,000 = $100,000
      // All taxed as ordinary income (no preferential LTCG rates)
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 50000,
        shortTermCapitalGains: 50000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Verify all gains are included in ordinary income
      expect(result.grossIncome).toBe(100000);
      expect(result.taxableLTCG).toBe(0); // CA doesn't separate LTCG
      // Tax should be > 0 and calculated on the full amount
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
    });
  });

  describe("mental health tax", () => {
    it("applies 1% mental health tax on income above $1M", () => {
      // Single filer with $1,100,000 income
      // Mental health tax = (taxable income - $1,000,000) * 1%
      const inputs = createDefaultInputs({
        federalIncome: 1100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Calculate expected: income - std deduction = $1,094,100
      // Mental health tax = ($1,094,100 - $1,000,000) * 0.01 = $941.00
      expect(result.caMentalHealthTax).toBeCloseTo(941, 2);
    });

    it("does not apply mental health tax at exactly $1M", () => {
      // Taxable income needs to be exactly $1M or less
      // $1,005,900 - $5,900 std deduction = $1,000,000 taxable
      const inputs = createDefaultInputs({
        federalIncome: 1005900,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.caMentalHealthTax).toBe(0);
    });
  });

  describe("safe harbor with high income exception", () => {
    it("only uses 90% current year method for high income taxpayers (AGI > $1M)", () => {
      // Single filer with $1,500,000 income
      // AGI > $1M, so high income exception applies
      // Cannot use 100% prior year method
      const inputs = createDefaultInputs({
        federalIncome: 1500000,
        priorYearStateTaxPaid: 50000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.highIncomeException).toBe(true);
      // Minimum should equal 90% of current year (not the lesser of 90%/100%)
      expect(result.safeHarbor!.minimum).toBeCloseTo(result.totalTax * 0.9, 2);
    });

    it("can use 100% prior year method when AGI is under threshold", () => {
      // Single filer with $500,000 income (under $1M threshold)
      const inputs = createDefaultInputs({
        federalIncome: 500000,
        priorYearStateTaxPaid: 100000, // High prior year to make 100% method more favorable
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.highIncomeException).toBe(false);
      // Should be able to use 100% prior year if it's lower
      expect(result.safeHarbor!.minimum).toBeLessThanOrEqual(
        result.totalTax * 0.9,
      );
    });

    it("uses $500k threshold for MFS high income exception", () => {
      // MFS threshold is $500k vs $1M for single/MFJ
      const inputs = createDefaultInputs({
        federalIncome: 600000,
        priorYearStateTaxPaid: 20000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.safeHarbor!.highIncomeException).toBe(true);
    });

    it("MFJ uses $1M threshold for high income exception", () => {
      // $900k AGI is under $1M threshold for MFJ
      const inputs = createDefaultInputs({
        federalIncome: 900000,
        priorYearStateTaxPaid: 30000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.safeHarbor!.highIncomeException).toBe(false);
    });
  });

  describe("loss carryovers in California", () => {
    it("applies ST loss carryover with $3,000 ordinary income limit", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 5000,
        priorYearShortTermLossCarryover: 10000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // $5k offsets ST gains, $3k offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(8000);
    });

    it("applies $1,500 limit for MFS loss carryover to ordinary income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 0,
        priorYearShortTermLossCarryover: 5000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.shortTermLossCarryoverOffset).toBe(1500);
    });

    it("LT loss carryover offsets capital gains (treated as ordinary in CA)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 30000,
        priorYearLongTermLossCarryover: 20000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      // Gross should reflect the offset
      expect(result.grossIncome).toBe(80000); // 50k + 30k
    });
  });

  describe("California income vs federal income", () => {
    it("uses stateIncome when specified instead of federalIncome", () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        stateIncome: 120000, // Different CA-source income
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.wageIncome).toBe(120000);
      expect(result.grossIncome).toBe(120000);
    });

    it("falls back to federalIncome when stateIncome is 0", () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        stateIncome: 0,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.wageIncome).toBe(150000);
    });
  });

  describe("mental health tax edge cases", () => {
    it("applies mental health tax to MFJ income over $1M", () => {
      // MFJ with $2M income
      const inputs = createDefaultInputs({
        federalIncome: 2000000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Taxable = $2M - $11,800 std = $1,988,200
      // Mental health = ($1,988,200 - $1M) * 1% = $9,882.00
      expect(result.caMentalHealthTax).toBeCloseTo(9882, 2);
    });

    it("mental health tax applies to capital gains income too", () => {
      // $500k wages + $600k LTCG = $1.1M
      const inputs = createDefaultInputs({
        federalIncome: 500000,
        longTermCapitalGains: 600000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Mental health tax should apply
      expect(result.caMentalHealthTax).toBeGreaterThan(0);
    });
  });

  describe("California bracket calculations", () => {
    it("calculates tax correctly through multiple brackets", () => {
      // $100k income, single filer
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Taxable = $100k - $5,900 = $94,100
      // Should span multiple brackets (1%, 2%, 4%, 6%, 8%, 9.3%)
      expect(result.taxableOrdinaryIncome).toBe(94100);
      expect(result.ordinaryIncomeBracketBreakdown.length).toBeGreaterThan(1);
    });

    it("handles top CA bracket (12.3%)", () => {
      // Very high income to hit 12.3% bracket (starts at $1,000,000 for single in 2026)
      const inputs = createDefaultInputs({
        federalIncome: 1100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      const topBracket = result.ordinaryIncomeBracketBreakdown.find(
        (b) => b.rate === 0.123,
      );
      expect(topBracket).toBeDefined();
    });
  });

  describe("401k deduction in California", () => {
    it("reduces CA taxable income by 401k contributions", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Gross = $100k, after 401k and std ded: $100k - $23.5k - $5,900 = $70,600
      expect(result.contributions401k).toBe(23500);
      expect(result.taxableOrdinaryIncome).toBe(70600);
    });
  });

  describe("pre-tax medical deduction in California", () => {
    it("reduces CA taxable income by pre-tax medical contributions", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        preTaxMedical: 10000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Gross = $100k, after pre-tax medical and std ded: $100k - $10k - $5,900 = $84,100
      expect(result.preTaxMedical).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(84100);
    });

    it("combines with 401k to reduce CA taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 20000,
        preTaxMedical: 5000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Gross = $100k, after both deductions: $100k - $20k - $5k - $5,900 = $69,100
      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.taxableOrdinaryIncome).toBe(69100);
    });
  });

  describe("negative LTCG (current year losses)", () => {
    it("treats negative LTCG as $0 for CA tax calculation", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -30000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Gross income should only include federal income (LTCG clamped to 0)
      expect(result.grossIncome).toBe(100000);
      // Original negative value should still be in result for display
      expect(result.longTermCapitalGains).toBe(-30000);
    });
  });

  describe("negative STCG (current year short-term losses)", () => {
    it("combines negative STCG with prior year carryover", () => {
      // $100,000 federal income, -$5,000 STCG, $2,000 prior carryover
      // Combined carryover = $7,000, offsets $3,000 ordinary income
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: -5000,
        priorYearShortTermLossCarryover: 2000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Gross income should not include negative STCG
      expect(result.grossIncome).toBe(100000);
      // Combined $7,000 carryover, $3,000 offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(4000);
    });
  });

  describe("refund and remaining owed", () => {
    it("calculates CA refund correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 60000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 2000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.totalPaid).toBe(7000);
      // Should have refund since $7k is likely more than CA tax on $60k
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it("calculates CA amount owed when underpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        stateTaxWithheld: 5000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.totalPaid).toBe(5000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe("self-employment income", () => {
    it("includes SE income in gross income when ficaData is provided", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
        ficaData,
      );

      // Gross = $100k + $50k SE = $150k
      expect(result.grossIncome).toBe(150000);
      expect(result.selfEmploymentIncome).toBe(50000);
    });

    it("calculates deductible half of SE tax", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
        ficaData,
      );

      // Deductible SE tax = 50% of SE tax
      // Net earnings = $50k * 0.9235 = $46,175
      // SS tax = $46,175 * 12.4% = $5,725.70
      // Medicare = $46,175 * 2.9% = $1,339.08
      // Deductible = ($5,725.70 + $1,339.08) * 50% = $3,532.39
      expect(result.deductibleSETax).toBeCloseTo(3532.39, 0);
    });

    it("reduces taxable income by deductible SE tax", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const resultWithSE = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
        ficaData,
      );

      const inputsNoSE = createDefaultInputs({
        federalIncome: 150000, // Same gross
        filingStatus: "single",
      });

      const resultNoSE = calculateCaliforniaTax(
        inputsNoSE,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // With SE, taxable income should be lower due to deductible SE tax
      expect(resultWithSE.taxableOrdinaryIncome).toBeLessThan(
        resultNoSE.taxableOrdinaryIncome,
      );
    });

    it("does not include SE fields when no SE income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
        ficaData,
      );

      expect(result.selfEmploymentIncome).toBeUndefined();
      expect(result.deductibleSETax).toBeUndefined();
    });

    it("works without ficaData (backwards compatibility)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
        // No ficaData
      );

      // SE income still included in gross
      expect(result.grossIncome).toBe(150000);
      // But no deductible SE tax calculated
      expect(result.deductibleSETax).toBeUndefined();
    });
  });

  describe("exact tax table verification", () => {
    it("single filer $100k matches CA FTB tax table - exact calculation", () => {
      // Gross: $100,000
      // Standard deduction: $5,900
      // Taxable: $94,100
      //
      // CA 2026 brackets (single):
      // $0 - $11,456 @ 1% = $114.56
      // $11,456 - $27,157 @ 2% = $15,701 × 0.02 = $314.02
      // $27,157 - $42,861 @ 4% = $15,704 × 0.04 = $628.16
      // $42,861 - $59,498 @ 6% = $16,637 × 0.06 = $998.22
      // $59,498 - $75,197 @ 8% = $15,699 × 0.08 = $1,255.92
      // $75,197 - $94,100 @ 9.3% = $18,903 × 0.093 = $1,757.98
      // Total: $5,068.86
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(94100);
      expect(result.ordinaryIncomeTax).toBeCloseTo(5068.86, 0);
    });

    it("single filer $200k matches CA FTB tax table - exact calculation", () => {
      // Gross: $200,000
      // Standard deduction: $5,900
      // Taxable: $194,100
      //
      // CA 2026 brackets (single):
      // $0 - $11,456 @ 1% = $114.56
      // $11,456 - $27,157 @ 2% = $314.02
      // $27,157 - $42,861 @ 4% = $628.16
      // $42,861 - $59,498 @ 6% = $998.22
      // $59,498 - $75,197 @ 8% = $1,255.92
      // $75,197 - $194,100 @ 9.3% = $118,903 × 0.093 = $11,057.98
      // Total: $14,368.86
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(194100);
      expect(result.ordinaryIncomeTax).toBeCloseTo(14368.86, 0);
    });

    it("MFJ filer $200k matches CA FTB tax table - exact calculation", () => {
      // Gross: $200,000
      // Standard deduction (MFJ): $11,800
      // Taxable: $188,200
      //
      // CA 2026 brackets (MFJ):
      // $0 - $22,912 @ 1% = $229.12
      // $22,912 - $54,314 @ 2% = $31,402 × 0.02 = $628.04
      // $54,314 - $85,722 @ 4% = $31,408 × 0.04 = $1,256.32
      // $85,722 - $118,996 @ 6% = $33,274 × 0.06 = $1,996.44
      // $118,996 - $150,394 @ 8% = $31,398 × 0.08 = $2,511.84
      // $150,394 - $188,200 @ 9.3% = $37,806 × 0.093 = $3,515.96
      // Total: $10,137.72
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(188200);
      expect(result.ordinaryIncomeTax).toBeCloseTo(10137.72, 0);
    });

    it("high income with mental health tax - exact calculation", () => {
      // Gross: $1,200,000
      // Standard deduction: $5,900
      // Taxable: $1,194,100
      //
      // Base tax through all 2026 brackets up to 12.3%:
      // $0 - $11,456 @ 1% = $114.56
      // $11,456 - $27,157 @ 2% = $15,701 × 0.02 = $314.02
      // $27,157 - $42,861 @ 4% = $15,704 × 0.04 = $628.16
      // $42,861 - $59,498 @ 6% = $16,637 × 0.06 = $998.22
      // $59,498 - $75,197 @ 8% = $15,699 × 0.08 = $1,255.92
      // $75,197 - $384,109 @ 9.3% = $308,912 × 0.093 = $28,728.82
      // $384,109 - $460,927 @ 10.3% = $76,818 × 0.103 = $7,912.25
      // $460,927 - $768,213 @ 11.3% = $307,286 × 0.113 = $34,723.32
      // $768,213 - $1,194,100 @ 12.3% = $425,887 × 0.123 = $52,384.10
      // Subtotal: $127,059.37
      //
      // Mental health tax: ($1,194,100 - $1,000,000) × 1% = $1,941.00
      // Total: $129,000.37
      const inputs = createDefaultInputs({
        federalIncome: 1200000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(1194100);
      expect(result.ordinaryIncomeTax).toBeCloseTo(127059.37, 0);
      expect(result.caMentalHealthTax).toBeCloseTo(1941, 2);
      expect(result.totalTax).toBeCloseTo(129000.37, 0);
    });
  });

  describe("edge cases", () => {
    it("applies mental health tax at exactly $1,000,000.01 over threshold", () => {
      // Taxable income just barely over $1M threshold
      // $1,005,900.01 - $5,900 std deduction = $1,000,000.01 taxable
      const inputs = createDefaultInputs({
        federalIncome: 1005900.01,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Mental health tax = $0.01 * 1% = $0.0001 (rounds to ~0)
      expect(result.caMentalHealthTax).toBeCloseTo(0.0001, 4);
    });

    it("handles zero CA income with federal income (uses federal as fallback)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateIncome: 0,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      // Should fall back to federal income
      expect(result.wageIncome).toBe(100000);
      expect(result.grossIncome).toBe(100000);
    });

    it("handles all inputs at zero", () => {
      const inputs = createDefaultInputs();

      const result = calculateCaliforniaTax(
        inputs,
        californiaBrackets,
        californiaDeductions,
        sharedLimits,
        californiaLimits,
      );

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.caMentalHealthTax).toBe(0);
    });
  });
});

// Multi-year parameterized tests
describe.each(SUPPORTED_YEARS)(
  "calculateCaliforniaTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("calculates tax correctly for single filer $100k", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        data.californiaBrackets,
        data.californiaDeductions,
        data.sharedLimits,
        data.californiaLimits,
      );

      // Standard deduction varies by year
      const expectedStdDeduction = {
        "2025": 5706,
        "2026": 5900,
      };
      const expectedTaxableIncome = 100000 - expectedStdDeduction[year];
      expect(result.taxableOrdinaryIncome).toBe(expectedTaxableIncome);

      // Tax amounts vary by year due to bracket differences
      const expectedTax = {
        "2025": 5207.98, // Based on 2025 brackets
        "2026": 5068.86, // 2026 has different bracket thresholds
      };
      expect(result.ordinaryIncomeTax).toBeCloseTo(expectedTax[year], 0);
    });

    it("applies mental health tax on income above $1M", () => {
      const inputs = createDefaultInputs({
        federalIncome: 1100000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        data.californiaBrackets,
        data.californiaDeductions,
        data.sharedLimits,
        data.californiaLimits,
      );

      // Mental health tax = (taxable - $1M) * 1%
      const expectedStdDeduction = {
        "2025": 5706,
        "2026": 5900,
      };
      const taxableIncome = 1100000 - expectedStdDeduction[year];
      const expectedMentalHealthTax = (taxableIncome - 1000000) * 0.01;

      expect(result.caMentalHealthTax).toBeCloseTo(expectedMentalHealthTax, 2);
    });

    it("uses correct standard deduction for year", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateCaliforniaTax(
        inputs,
        data.californiaBrackets,
        data.californiaDeductions,
        data.sharedLimits,
        data.californiaLimits,
      );

      const expectedStdDeduction = {
        "2025": 5706,
        "2026": 5900,
      };

      expect(result.deductionBreakdown.deductionAmount).toBe(
        expectedStdDeduction[year],
      );
    });

    it("uses correct MFJ standard deduction for year", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateCaliforniaTax(
        inputs,
        data.californiaBrackets,
        data.californiaDeductions,
        data.sharedLimits,
        data.californiaLimits,
      );

      const expectedStdDeduction = {
        "2025": 11412,
        "2026": 11800,
      };

      expect(result.deductionBreakdown.deductionAmount).toBe(
        expectedStdDeduction[year],
      );
    });
  },
);
