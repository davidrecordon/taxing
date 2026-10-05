import { describe, it, expect, beforeAll } from "vitest";
import { calculateDCTax } from "../states/dcTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import {
  dcBrackets,
  dcDeductions,
  dcLimits,
  sharedLimits,
  federalLimits,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

describe("calculateDCTax", () => {
  describe("progressive bracket calculation", () => {
    it("calculates tax correctly for income in first bracket", () => {
      const inputs = createDefaultInputs({
        federalIncome: 8000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // $8k income, $15k standard deduction = $0 taxable
      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("calculates tax for income in middle brackets", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // $100k - $16,100 standard deduction = $83,900 taxable
      // First $10k @ 4% = $400
      // $10k - $40k (30k) @ 6% = $1,800
      // $40k - $60k (20k) @ 6.5% = $1,300
      // $60k - $83.9k (23.9k) @ 8.5% = $2,031.50
      // Total = $5,531.50
      expect(result.taxableOrdinaryIncome).toBe(83900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(5531.5, 0);
    });

    it("calculates tax for high income in top bracket", () => {
      const inputs = createDefaultInputs({
        federalIncome: 2000000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // $2M - $16,100 deduction = $1,983,900 taxable
      // First $10k @ 4% = $400
      // $10k - $40k @ 6% = $1,800
      // $40k - $60k @ 6.5% = $1,300
      // $60k - $250k @ 8.5% = $16,150
      // $250k - $500k @ 9.25% = $23,125
      // $500k - $1M @ 9.75% = $48,750
      // $1M - $1.9839M @ 10.75% = $105,769.25
      // Total = ~$197,294.25
      expect(result.taxableOrdinaryIncome).toBe(1983900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(197294.25, 0);
    });
  });

  describe("filing status handling", () => {
    it("uses same brackets for all filing statuses", () => {
      const singleInputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const mfjInputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "dc",
        filingStatus: "marriedFilingJointly",
      });

      const singleResult = calculateDCTax(
        singleInputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      const mfjResult = calculateDCTax(
        mfjInputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // Single: $100k - $16,100 = $83,900 taxable
      // MFJ: $100k - $32,200 = $67,800 taxable
      expect(singleResult.taxableOrdinaryIncome).toBe(83900);
      expect(mfjResult.taxableOrdinaryIncome).toBe(67800);

      // MFJ has higher deduction, so lower tax
      expect(mfjResult.totalTax).toBeLessThan(singleResult.totalTax);
    });

    it("applies MFS standard deduction correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        selectedState: "dc",
        filingStatus: "marriedFilingSeparately",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // $50k - $16,100 MFS standard deduction = $33,900 taxable
      expect(result.taxableOrdinaryIncome).toBe(33900);
      expect(result.deductionBreakdown.standardDeduction).toBe(16100);
    });
  });

  describe("capital gains treatment", () => {
    it("taxes capital gains as ordinary income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        longTermCapitalGains: 50000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // $100k gross - $16,100 deduction = $83,900 taxable
      expect(result.grossIncome).toBe(100000);
      expect(result.taxableOrdinaryIncome).toBe(83900);
      expect(result.ltcgTax).toBe(0); // No separate LTCG treatment
    });

    it("applies capital loss carryover correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        longTermCapitalGains: 20000,
        priorYearLongTermLossCarryover: 10000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // Gross = $120k, less $10k LTCG offset, less $16,100 deduction = $93,900 taxable
      expect(result.longTermLossCarryoverOffset).toBe(10000);
      expect(result.taxableOrdinaryIncome).toBe(93900);
    });
  });

  describe("safe harbor", () => {
    it("calculates safe harbor correctly (90%/110%)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 5000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      expect(result.safeHarbor).toBeDefined();
      // 90% of current year tax
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        result.totalTax * 0.9,
        0,
      );
      // 110% of prior year tax
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(5500);
    });

    it("safe harbor met when fully paid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 6000,
        priorYearStateTaxPaid: 5000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // Tax is ~$5,625, paid $6,000
      expect(result.safeHarbor!.met).toBe(true);
    });
  });

  describe("payment summary", () => {
    it("calculates remaining owed correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 3000,
        stateEstimatedPaid: 1000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      expect(result.totalPaid).toBe(4000);
      // Tax = ~$5,531.50, paid $4,000, owed ~$1,531.50
      expect(result.remainingOwed).toBeCloseTo(1531.5, 0);
      expect(result.refundDue).toBe(0);
    });

    it("calculates refund correctly when overpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        stateTaxWithheld: 5000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // $50k - $15k = $35k taxable
      // Tax = ~$2,100, paid $5,000
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe("deductions", () => {
    it("uses itemized when greater than standard", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        mortgageInterestPaid: 20000,
        charitableContributions: 10000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // Itemized = $30k > $16,100 standard
      expect(result.deductionBreakdown.deductionUsed).toBe("itemized");
      expect(result.deductionBreakdown.deductionAmount).toBe(30000);
      expect(result.taxableOrdinaryIncome).toBe(170000);
    });

    it("does not include SALT in itemized deductions", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        propertyTaxesPaid: 15000,
        stateTaxWithheld: 10000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // DC doesn't allow SALT deduction
      expect(result.deductionBreakdown.saltDeduction).toBe(0);
      // Should use standard deduction since no other itemized
      expect(result.deductionBreakdown.deductionUsed).toBe("standard");
    });
  });

  describe("edge cases", () => {
    it("handles zero income", () => {
      const inputs = createDefaultInputs({
        selectedState: "dc",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("handles self-employment income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        selfEmploymentIncome: 50000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        dcBrackets,
        dcDeductions,
        sharedLimits,
        federalLimits,
        dcLimits,
        ficaData,
      );

      // SE income included in gross, with deductible SE tax
      expect(result.grossIncome).toBe(100000);
      expect(result.selfEmploymentIncome).toBe(50000);
      expect(result.deductibleSETax).toBeGreaterThan(0);
    });
  });
});

// Multi-year parameterized tests
describe.each(SUPPORTED_YEARS)(
  "calculateDCTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    it("uses correct standard deduction for year", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        data.dcBrackets,
        data.dcDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.dcLimits,
        data.ficaData,
      );

      // DC standard deduction varies by year
      const expectedStdDeduction = {
        "2025": 15000,
        "2026": 16100,
      };

      expect(result.deductionBreakdown.standardDeduction).toBe(
        expectedStdDeduction[year],
      );
    });

    it("calculates tax correctly for middle bracket income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "dc",
        filingStatus: "single",
      });

      const result = calculateDCTax(
        inputs,
        data.dcBrackets,
        data.dcDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.dcLimits,
        data.ficaData,
      );

      // Brackets are unchanged; the standard deduction differs by year
      // 2025: $100k - $15,000 = $85,000 taxable
      // 2026: $100k - $16,100 = $83,900 taxable
      const expectedTaxableIncome = {
        "2025": 85000,
        "2026": 83900,
      };
      const expectedTax = {
        "2025": 5625,
        "2026": 5531.5,
      };

      expect(result.taxableOrdinaryIncome).toBe(expectedTaxableIncome[year]);
      expect(result.ordinaryIncomeTax).toBeCloseTo(expectedTax[year], 0);
    });

    it("applies correct MFJ standard deduction for year", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "dc",
        filingStatus: "marriedFilingJointly",
      });

      const result = calculateDCTax(
        inputs,
        data.dcBrackets,
        data.dcDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.dcLimits,
        data.ficaData,
      );

      // DC MFJ standard deduction
      const expectedStdDeduction = {
        "2025": 30000,
        "2026": 32200,
      };

      expect(result.deductionBreakdown.standardDeduction).toBe(
        expectedStdDeduction[year],
      );
      const expectedTaxable = 100000 - expectedStdDeduction[year];
      expect(result.taxableOrdinaryIncome).toBe(expectedTaxable);
    });
  },
);
