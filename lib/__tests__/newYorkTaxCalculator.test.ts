import { describe, it, expect, beforeAll } from "vitest";
import {
  calculateNewYorkTax,
  calculateNYCSchoolTaxCredit,
  calculateTaxBenefitRecapture,
} from "../states/newYorkTaxCalculator";
import { calculateTaxByBrackets } from "../taxUtils";
import { FilingStatus } from "../types";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import {
  newYorkBrackets,
  nycBrackets,
  newYorkDeductions,
  newYorkLimits,
  sharedLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

describe("calculateNewYorkTax", () => {
  describe("capital gains as ordinary income", () => {
    it("taxes both short-term and long-term capital gains at ordinary rates", () => {
      const inputs = createDefaultInputs({
        federalIncome: 0,
        longTermCapitalGains: 50000,
        shortTermCapitalGains: 50000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.grossIncome).toBe(100000);
      expect(result.taxableLTCG).toBe(0); // NY doesn't separate LTCG
      expect(result.ordinaryIncomeTax).toBeGreaterThan(0);
    });
  });

  describe("NYC local tax", () => {
    it("applies NYC local tax when isNYCResident is true", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.nycTax).toBeDefined();
      expect(result.nycTax).toBeGreaterThan(0);
      expect(result.nycBracketBreakdown).toBeDefined();
      expect(result.nycBracketBreakdown!.length).toBeGreaterThan(0);
      // Total should be state + NYC less the NYC school tax credit
      expect(result.nycSchoolTaxCredit).toBeGreaterThan(0);
      expect(result.totalTax).toBeCloseTo(
        result.ordinaryIncomeTax + result.nycTax! - result.nycSchoolTaxCredit!,
        2,
      );
    });

    it("does not apply NYC tax when isNYCResident is false", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
        isNYCResident: false,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.nycTax).toBeUndefined();
      expect(result.nycBracketBreakdown).toBeUndefined();
      expect(result.totalTax).toBe(result.ordinaryIncomeTax);
    });

    it("does not apply NYC tax when isNYCResident is not set", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.nycTax).toBeUndefined();
      expect(result.totalTax).toBe(result.ordinaryIncomeTax);
    });
  });

  describe("safe harbor with high income rule", () => {
    it("uses 110% prior year for high income (AGI > $150k)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        priorYearStateTaxPaid: 10000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.isHighIncome).toBe(true);
      // 110% of $10k = $11k
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(11000, 2);
    });

    it("uses 100% prior year for income under $150k", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 5000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.safeHarbor).toBeDefined();
      expect(result.safeHarbor!.isHighIncome).toBe(false);
      // 100% of $5k = $5k
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5000, 2);
    });

    it("uses $75k threshold for MFS high income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000, // Over $75k for MFS
        priorYearStateTaxPaid: 5000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.safeHarbor!.isHighIncome).toBe(true);
      // 110% of $5k = $5.5k
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(5500, 2);
    });

    it("MFJ uses $150k threshold", () => {
      const inputs = createDefaultInputs({
        federalIncome: 140000, // Under $150k for MFJ
        priorYearStateTaxPaid: 5000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.safeHarbor!.isHighIncome).toBe(false);
    });
  });

  describe("loss carryovers", () => {
    it("applies ST loss carryover with $3,000 ordinary income limit", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 5000,
        priorYearShortTermLossCarryover: 10000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
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

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.shortTermLossCarryoverOffset).toBe(1500);
    });

    it("LT loss carryover offsets long-term capital gains", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 30000,
        priorYearLongTermLossCarryover: 20000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.longTermLossCarryoverOffset).toBe(20000);
      expect(result.grossIncome).toBe(80000); // 50k + 30k
    });
  });

  describe("NY income vs federal income", () => {
    it("uses stateIncome when specified instead of federalIncome", () => {
      const inputs = createDefaultInputs({
        federalIncome: 150000,
        stateIncome: 120000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
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

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.wageIncome).toBe(150000);
    });
  });

  describe("401k deduction", () => {
    it("reduces NY taxable income by 401k contributions", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 23500,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // Gross = $100k, after 401k and std ded: $100k - $23.5k - $8,000 = $68,500
      expect(result.contributions401k).toBe(23500);
      expect(result.taxableOrdinaryIncome).toBe(68500);
    });
  });

  describe("pre-tax medical deduction", () => {
    it("reduces NY taxable income by pre-tax medical contributions", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        preTaxMedical: 10000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // Gross = $100k, after pre-tax medical and std ded: $100k - $10k - $8,000 = $82,000
      expect(result.preTaxMedical).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(82000);
    });

    it("combines with 401k to reduce NY taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        contributions401k: 20000,
        preTaxMedical: 5000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // Gross = $100k, after both deductions: $100k - $20k - $5k - $8,000 = $67,000
      expect(result.contributions401k).toBe(20000);
      expect(result.preTaxMedical).toBe(5000);
      expect(result.taxableOrdinaryIncome).toBe(67000);
    });
  });

  describe("negative LTCG (current year losses)", () => {
    it("treats negative LTCG as $0 for NY tax calculation", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: -25000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // Gross income should only include federal income (LTCG clamped to 0)
      expect(result.grossIncome).toBe(100000);
      // Original negative value should still be in result for display
      expect(result.longTermCapitalGains).toBe(-25000);
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

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // Gross income should not include negative STCG
      expect(result.grossIncome).toBe(100000);
      // Combined $7,000 carryover, $3,000 offsets ordinary income
      expect(result.shortTermLossCarryoverOffset).toBe(3000);
      expect(result.shortTermLossCarryoverUnused).toBe(4000);
    });
  });

  describe("NY bracket calculations", () => {
    it("calculates tax correctly through multiple brackets", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // Taxable = $100k - $8k = $92k
      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeBracketBreakdown.length).toBeGreaterThan(1);
    });

    it("handles top NY bracket (10.9%)", () => {
      // Very high income to hit 10.9% bracket (starts at $25M for single)
      const inputs = createDefaultInputs({
        federalIncome: 30000000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      const topBracket = result.ordinaryIncomeBracketBreakdown.find(
        (b) => b.rate === 0.109,
      );
      expect(topBracket).toBeDefined();
    });
  });

  describe("refund and remaining owed", () => {
    it("calculates NY refund correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 60000,
        stateTaxWithheld: 5000,
        stateEstimatedPaid: 2000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.totalPaid).toBe(7000);
      // Should have refund since $7k is likely more than NY tax on $60k
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });

    it("calculates NY amount owed when underpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        stateTaxWithheld: 5000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.totalPaid).toBe(5000);
      expect(result.remainingOwed).toBeGreaterThan(0);
      expect(result.refundDue).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles all inputs at zero", () => {
      const inputs = createDefaultInputs();

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("handles NYC resident with zero income", () => {
      const inputs = createDefaultInputs({
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.nycTax).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("correctly identifies high income at exactly $150,001", () => {
      const inputs = createDefaultInputs({
        federalIncome: 150001,
        priorYearStateTaxPaid: 1000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.safeHarbor!.isHighIncome).toBe(true);
    });

    it("correctly identifies non-high income at exactly $150,000", () => {
      // Need to account for 401k and deductions to get AGI exactly at threshold
      // With $8k std deduction, need $158k gross to get $150k AGI
      const inputs = createDefaultInputs({
        federalIncome: 158000,
        priorYearStateTaxPaid: 1000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // AGI = $158k - deductions, threshold check is on nyAgi which doesn't include deductions
      // nyAgi = grossIncome - carryovers - 401k = $158k
      expect(result.safeHarbor!.isHighIncome).toBe(true);
    });
  });

  describe("self-employment income", () => {
    it("includes SE income in gross income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
        ficaData,
      );

      expect(result.grossIncome).toBe(150000);
      expect(result.selfEmploymentIncome).toBe(50000);
    });

    it("calculates deductible half of SE tax", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
        ficaData,
      );

      // Deductible SE tax = 50% of SE tax
      expect(result.deductibleSETax).toBeCloseTo(3532, 0);
    });

    it("reduces taxable income by deductible SE tax", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
        ficaData,
      );

      // Gross = $150k, less deductible SE tax (~$3,532), less std ded ($8,000)
      // Taxable = $150k - $3,532 - $8,000 = $138,468
      expect(result.taxableOrdinaryIncome).toBeCloseTo(138468, 0);
    });

    it("does not include SE fields when no SE income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
        ficaData,
      );

      expect(result.selfEmploymentIncome).toBeUndefined();
      expect(result.deductibleSETax).toBeUndefined();
    });

    it("SE income counts toward NYC local tax", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selfEmploymentIncome: 50000,
        filingStatus: "single",
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
        ficaData,
      );

      expect(result.nycTax).toBeDefined();
      expect(result.nycTax).toBeGreaterThan(0);
      // NYC tax should be based on the full taxable income including SE
      expect(result.grossIncome).toBe(150000);
    });
  });

  describe("exact tax table verification", () => {
    it("single filer $100k matches NY DTF tax table - exact calculation", () => {
      // Gross: $100,000
      // Standard deduction: $8,000
      // Taxable: $92,000
      //
      // NY 2026 brackets (single):
      // $0 - $8,500 @ 3.9% = $331.50
      // $8,500 - $11,700 @ 4.4% = $3,200 × 0.044 = $140.80
      // $11,700 - $13,900 @ 5.15% = $2,200 × 0.0515 = $113.30
      // $13,900 - $80,650 @ 5.4% = $66,750 × 0.054 = $3,604.50
      // $80,650 - $92,000 @ 5.9% = $11,350 × 0.059 = $669.65
      // Total: $4,859.75
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4859.75, 0);
    });

    it("single filer $200k matches NY DTF tax table - exact calculation", () => {
      // Gross: $200,000
      // Standard deduction: $8,000
      // Taxable: $192,000
      //
      // NY 2026 brackets (single):
      // $0 - $8,500 @ 3.9% = $331.50
      // $8,500 - $11,700 @ 4.4% = $140.80
      // $11,700 - $13,900 @ 5.15% = $113.30
      // $13,900 - $80,650 @ 5.4% = $3,604.50
      // $80,650 - $192,000 @ 5.9% = $111,350 × 0.059 = $6,569.65
      // Total: $10,759.75
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(192000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(10759.75, 0);
    });

    it("NYC resident $100k matches combined NY + NYC tables - exact calculation", () => {
      // Gross: $100,000
      // Standard deduction: $8,000
      // Taxable: $92,000
      //
      // NY state tax: $4,859.75 (calculated above)
      //
      // NYC tax (single, $92,000):
      // $0 - $12,000 @ 3.078% = $369.36
      // $12,000 - $25,000 @ 3.762% = $13,000 × 0.03762 = $489.06
      // $25,000 - $50,000 @ 3.819% = $25,000 × 0.03819 = $954.75
      // $50,000 - $92,000 @ 3.876% = $42,000 × 0.03876 = $1,627.92
      // Total NYC: $3,441.09
      //
      // Combined: $4,859.75 + $3,441.09 = $8,300.84
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
        isNYCResident: true,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(4859.75, 0);
      expect(result.nycTax).toBeCloseTo(3441.09, 0);
      // NYC school tax credit: $63 + $21 + 0.228% x ($92,000 - $12,000)
      expect(result.nycSchoolTaxCredit).toBeCloseTo(266.4, 2);
      expect(result.totalTax).toBeCloseTo(8034.44, 0);
    });

    it("MFJ filer $200k matches NY DTF tax table - exact calculation", () => {
      // Gross: $200,000
      // Standard deduction (MFJ): $16,050
      // Taxable: $183,950
      //
      // NY 2026 brackets (MFJ):
      // $0 - $17,150 @ 3.9% = $668.85
      // $17,150 - $23,600 @ 4.4% = $6,450 × 0.044 = $283.80
      // $23,600 - $27,900 @ 5.15% = $4,300 × 0.0515 = $221.45
      // $27,900 - $161,550 @ 5.4% = $133,650 × 0.054 = $7,217.10
      // $161,550 - $183,950 @ 5.9% = $22,400 × 0.059 = $1,321.60
      // Total: $9,712.80
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(183950);
      expect(result.ordinaryIncomeTax).toBeCloseTo(9712.8, 0);
    });

    it("MFS filer $208k uses the single schedule - exact calculation", () => {
      // Gross: $208,000
      // Standard deduction (MFS): $8,000
      // Taxable: $200,000
      //
      // NY 2026 brackets (single and MFS):
      // $0 - $8,500 @ 3.9% = $331.50
      // $8,500 - $11,700 @ 4.4% = $140.80
      // $11,700 - $13,900 @ 5.15% = $113.30
      // $13,900 - $80,650 @ 5.4% = $3,604.50
      // $80,650 - $200,000 @ 5.9% = $119,350 × 0.059 = $7,041.65
      // Total: $11,231.75
      const inputs = createDefaultInputs({
        federalIncome: 208000,
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(200000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(11231.75, 0);
    });

    it("high income single filer hits 6.85% bracket - exact calculation", () => {
      // Gross: $300,000
      // Standard deduction: $8,000
      // Taxable: $292,000
      //
      // NY 2026 brackets (single):
      // $0 - $8,500 @ 3.9% = $331.50
      // $8,500 - $11,700 @ 4.4% = $140.80
      // $11,700 - $13,900 @ 5.15% = $113.30
      // $13,900 - $80,650 @ 5.4% = $3,604.50
      // $80,650 - $215,400 @ 5.9% = $134,750 × 0.059 = $7,950.25
      // $215,400 - $292,000 @ 6.85% = $76,600 × 0.0685 = $5,247.10
      // Total: $17,387.45
      const inputs = createDefaultInputs({
        federalIncome: 300000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.taxableOrdinaryIncome).toBe(292000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(17387.45, 0);
    });
  });

  describe("deduction types", () => {
    it("uses standard deduction when itemized is lower", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
        // No itemized deductions
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      expect(result.deductionBreakdown.deductionUsed).toBe("standard");
      expect(result.deductionBreakdown.deductionAmount).toBe(8000); // NY single std deduction
    });

    it("uses itemized deduction when higher than standard", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "single",
        mortgageInterestPaid: 15000,
        charitableContributions: 5000,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // $20,000 mortgage + charitable, less the 25% adjustment for NY AGI
      // over $150,000 (single)
      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.highIncomeReduction).toBe(5000);
      expect(result.deductionBreakdown.deductionAmount).toBe(15000);
    });

    it("deducts property tax but not state income tax", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "single",
        propertyTaxesPaid: 20000,
        stateTaxWithheld: 10000,
      });

      const result = calculateNewYorkTax(
        inputs,
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

      // State income tax is not deductible; property tax is, with no cap.
      // $20,000 less the 25% adjustment = $15,000
      expect(result.deductionBreakdown.saltDeduction).toBe(0);
      expect(result.deductionBreakdown.propertyTax).toBe(20000);
      expect(result.deductionBreakdown.deductionAmount).toBe(15000);
    });
  });
});

describe("calculateTaxBenefitRecapture", () => {
  // Recapture for a given NY AGI and taxable income, using the rate schedule
  // tax for that year as the starting point
  const recaptureFor = (
    year: TaxYear,
    filingStatus: FilingStatus,
    agi: number,
    taxableIncome: number,
  ) => {
    const data = loadTestDataForYear(year);
    const bracketTax = calculateTaxByBrackets(
      taxableIncome,
      data.newYorkBrackets.brackets[filingStatus],
    ).total;
    return {
      bracketTax,
      recapture: calculateTaxBenefitRecapture(
        bracketTax,
        taxableIncome,
        agi,
        filingStatus,
        data.newYorkLimits,
      ),
    };
  };

  it("adds nothing at or below $107,650 of NY AGI", () => {
    expect(recaptureFor("2025", "single", 107650, 99650).recapture).toBe(0);
    expect(
      recaptureFor("2025", "marriedFilingJointly", 100000, 83950).recapture,
    ).toBe(0);
  });

  // Worked from the 2025 IT-201 tax computation worksheets:
  // [filing status, NY AGI, taxable income, recapture]
  it.each<[FilingStatus, number, number, number]>([
    // First tier, phasing toward 6% (single) or 5.5% (joint) of taxable income
    ["single", 110000, 102000, 26.71], // 568.25 x 0.0470
    ["single", 130000, 122000, 254.01], // 568.25 x 0.4470
    ["marriedFilingJointly", 108000, 91950, 2.33], // 332.50 x 0.0070
    ["marriedFilingJointly", 150000, 133950, 281.63], // 332.50 x 0.8470
    // Upper tiers: recapture base + incremental benefit x phase-in
    ["marriedFilingSeparately", 240000, 232000, 1468.85], // 568 + 1,831 x 0.4920
    ["single", 300000, 292000, 2399], // 568 + 1,831
    ["marriedFilingJointly", 400000, 380000, 3887], // 1,140 + 2,747
    ["single", 1100000, 1092000, 15946.23], // 2,399 + 30,172 x 0.4490
    ["marriedFilingJointly", 2180000, 2163950, 33639.55], // 3,887 + 60,350 x 0.4930
    ["single", 3000000, 2992000, 32571], // 2,399 + 30,172
    ["marriedFilingJointly", 5020000, 5003950, 77237], // 64,237 + 32,500 x 0.4
    ["single", 10000000, 9992000, 65071], // 32,571 + 32,500
    // Taxable income in a lower tier than AGI: the taxable income tier applies
    ["marriedFilingJointly", 400000, 300000, 1140], // 333 + 807
  ])("2025 %s, AGI %i, taxable income %i", (status, agi, taxable, expected) => {
    expect(recaptureFor("2025", status, agi, taxable).recapture).toBeCloseTo(
      expected,
      2,
    );
  });

  it("taxes all taxable income at the flat rate once the first tier is phased in", () => {
    // Single, AGI $200,000 with taxable income of $70,000: 6% x $70,000
    const { bracketTax, recapture } = recaptureFor(
      "2025",
      "single",
      200000,
      70000,
    );

    expect(bracketTax + recapture).toBeCloseTo(4200, 2);
  });

  it("taxes all taxable income at 10.9% above $25,000,000 of NY AGI", () => {
    const { bracketTax, recapture } = recaptureFor(
      "2025",
      "marriedFilingJointly",
      30000000,
      29983950,
    );

    expect(recapture).toBeCloseTo(246737.25, 1);
    expect(bracketTax + recapture).toBeCloseTo(3268250.55, 1);
  });

  // 2026 amounts from the 2026 IT-2105 worksheets
  it.each<[FilingStatus, number, number, number]>([
    ["single", 130000, 122000, 254.01], // 5.9% first tier
    ["marriedFilingJointly", 150000, 133950, 281.63], // 5.4% first tier
    ["marriedFilingJointly", 400000, 380000, 4211], // 1,140 + 3,071
    ["single", 300000, 292000, 2614], // 567 + 2,047
  ])("2026 %s, AGI %i, taxable income %i", (status, agi, taxable, expected) => {
    expect(recaptureFor("2026", status, agi, taxable).recapture).toBeCloseTo(
      expected,
      2,
    );
  });

  it("is included in the New York total", () => {
    // Single, $130,000 wages: taxable income $122,000 after the $8,000
    // standard deduction
    const result = calculateNewYorkTax(
      createDefaultInputs({ federalIncome: 130000, filingStatus: "single" }),
      newYorkBrackets,
      nycBrackets,
      newYorkDeductions,
      sharedLimits,
      newYorkLimits,
    );

    expect(result.nyTaxBenefitRecapture).toBeCloseTo(254.01, 2);
    expect(result.totalTax).toBeCloseTo(result.ordinaryIncomeTax + 254.01, 2);
  });
});

describe("calculateNYCSchoolTaxCredit", () => {
  const credit = (
    taxableIncome: number,
    agi: number,
    filingStatus: FilingStatus = "single",
  ) =>
    calculateNYCSchoolTaxCredit(
      taxableIncome,
      agi,
      filingStatus,
      newYorkLimits,
    );

  it("adds the fixed amount and the rate reduction amount", () => {
    // $63 + $21 + 0.228% x ($92,000 - $12,000)
    expect(credit(92000, 100000)).toBeCloseTo(266.4, 2);
  });

  it("uses 0.171% of taxable income up to the threshold", () => {
    // Joint: $125 + 0.171% x $21,600
    expect(credit(21600, 40000, "marriedFilingJointly")).toBeCloseTo(161.94, 2);
  });

  it("drops the fixed amount above $250,000 of income", () => {
    // $21 + 0.228% x ($300,000 - $12,000)
    expect(credit(300000, 310000)).toBeCloseTo(677.64, 2);
  });

  it("allows no rate reduction amount above $500,000 of taxable income", () => {
    expect(credit(500000, 520000)).toBeCloseTo(1133.64, 2);
    expect(credit(500001, 520000)).toBe(0);
  });

  it("applies only to New York City residents", () => {
    const inputs = { federalIncome: 100000, filingStatus: "single" as const };
    const calculate = (isNYCResident: boolean) =>
      calculateNewYorkTax(
        createDefaultInputs({ ...inputs, isNYCResident }),
        newYorkBrackets,
        nycBrackets,
        newYorkDeductions,
        sharedLimits,
        newYorkLimits,
      );

    expect(calculate(true).nycSchoolTaxCredit).toBeCloseTo(266.4, 2);
    expect(calculate(false).nycSchoolTaxCredit).toBeUndefined();
  });
});

// Multi-year parameterized tests
describe.each(SUPPORTED_YEARS)(
  "calculateNewYorkTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("uses correct standard deduction for year", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        data.newYorkBrackets,
        data.nycBrackets,
        data.newYorkDeductions,
        data.sharedLimits,
        data.newYorkLimits,
      );

      // NY standard deduction varies by year
      const expectedStdDeduction = {
        "2025": 8000,
        "2026": 8000,
      };

      expect(result.deductionBreakdown.standardDeduction).toBe(
        expectedStdDeduction[year],
      );
    });

    it("calculates tax correctly for single filer $100k", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        filingStatus: "single",
      });

      const result = calculateNewYorkTax(
        inputs,
        data.newYorkBrackets,
        data.nycBrackets,
        data.newYorkDeductions,
        data.sharedLimits,
        data.newYorkLimits,
      );

      // Tax amounts (2026 has 0.1% lower rates for bottom 5 brackets)
      const expectedTax = {
        "2025": 4951.75,
        "2026": 4859.75,
      };

      expect(result.taxableOrdinaryIncome).toBe(92000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(expectedTax[year], 0);
    });

    it("uses correct MFJ standard deduction for year", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateNewYorkTax(
        inputs,
        data.newYorkBrackets,
        data.nycBrackets,
        data.newYorkDeductions,
        data.sharedLimits,
        data.newYorkLimits,
      );

      // NY MFJ standard deduction varies by year
      const expectedStdDeduction = {
        "2025": 16050,
        "2026": 16050,
      };

      expect(result.deductionBreakdown.standardDeduction).toBe(
        expectedStdDeduction[year],
      );
    });
  },
);
