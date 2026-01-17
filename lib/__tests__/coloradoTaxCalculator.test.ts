import { describe, it, expect, beforeAll } from "vitest";
import { calculateColoradoTax } from "../states/coloradoTaxCalculator";
import { calculateFederalTax } from "../federalTaxCalculator";
import { SUPPORTED_YEARS, TaxYear } from "../config";
import {
  coloradoBrackets,
  coloradoLimits,
  sharedLimits,
  federalBrackets,
  federalDeductions,
  federalLimits,
  ltcgBrackets,
  ficaData,
  createDefaultInputs,
  loadTestDataForYear,
  TestDataForYear,
} from "./testData";

// Helper to get federal taxable income for Colorado
function getFederalTaxableIncome(
  inputs: ReturnType<typeof createDefaultInputs>,
) {
  const federal = calculateFederalTax(
    inputs,
    federalBrackets,
    ltcgBrackets,
    federalDeductions,
    sharedLimits,
    federalLimits,
    ficaData,
  );
  return federal.taxableOrdinaryIncome + federal.taxableLTCG;
}

describe("calculateColoradoTax", () => {
  describe("flat rate calculation", () => {
    it("calculates tax at 4.4% flat rate on federal taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      // Federal taxable income = $100k - $15,750 standard deduction = $84,250
      // Colorado tax = $84,250 * 4.4% = $3,707
      expect(result.taxableOrdinaryIncome).toBe(84250);
      expect(result.ordinaryIncomeTax).toBeCloseTo(3707, 0);
      expect(result.totalTax).toBeCloseTo(3707, 0);
    });

    it("uses federal taxable income for all filing statuses", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "colorado",
        filingStatus: "marriedFilingJointly",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      // Federal taxable income = $100k - $31,500 standard deduction (MFJ) = $68,500
      // Colorado tax = $68,500 * 4.4% = $3,014
      expect(result.taxableOrdinaryIncome).toBe(68500);
      expect(result.ordinaryIncomeTax).toBeCloseTo(3014, 0);
    });
  });

  describe("capital gains treatment", () => {
    it("includes capital gains in federal taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        shortTermCapitalGains: 25000,
        longTermCapitalGains: 25000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      // Gross = $100k, less $15,750 std deduction = $84,250 federal taxable
      expect(result.taxableOrdinaryIncome).toBe(84250);
      expect(result.ltcgTax).toBe(0); // No separate LTCG treatment
    });
  });

  describe("safe harbor", () => {
    it("calculates safe harbor correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 4000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      expect(result.safeHarbor).toBeDefined();
      // 90% of current year tax
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        result.totalTax * 0.9,
        0,
      );
      // 100% of prior year tax
      expect(result.safeHarbor!.priorYearSafeHarbor).toBe(4000);
    });
  });

  describe("payment summary", () => {
    it("calculates remaining owed correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 2000,
        stateEstimatedPaid: 1000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      expect(result.totalPaid).toBe(3000);
      // Tax = ~$3,707, paid $3,000, owed ~$707
      expect(result.remainingOwed).toBeCloseTo(707, 0);
      expect(result.refundDue).toBe(0);
    });

    it("calculates refund correctly when overpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        stateTaxWithheld: 3000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      // Tax = ~$1,540 (35k * 4.4%), paid $3,000
      expect(result.refundDue).toBeGreaterThan(0);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles zero income", () => {
      const inputs = createDefaultInputs({
        selectedState: "colorado",
      });

      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        0,
        ficaData,
      );

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.totalTax).toBe(0);
    });

    it("handles itemized deductions reducing federal taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 200000,
        propertyTaxesPaid: 10000,
        mortgageInterestPaid: 20000,
        charitableContributions: 10000,
        selectedState: "colorado",
        filingStatus: "marriedFilingJointly",
      });

      const federalTaxableIncome = getFederalTaxableIncome(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federalTaxableIncome,
        ficaData,
      );

      // $200k - $40k itemized = $160k federal taxable
      // Colorado tax = $160k * 4.4% = $7,040
      expect(result.taxableOrdinaryIncome).toBe(160000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(7040, 0);
    });
  });
});

// Multi-year parameterized tests
describe.each(SUPPORTED_YEARS)(
  "calculateColoradoTax - tax year %s",
  (year: TaxYear) => {
    let data: TestDataForYear;

    beforeAll(() => {
      data = loadTestDataForYear(year);
    });

    // Helper to get federal taxable income for a specific year
    function getFederalTaxableIncomeForYear(
      inputs: ReturnType<typeof createDefaultInputs>,
    ) {
      const federal = calculateFederalTax(
        inputs,
        data.federalBrackets,
        data.ltcgBrackets,
        data.federalDeductions,
        data.sharedLimits,
        data.federalLimits,
        data.ficaData,
      );
      return federal.taxableOrdinaryIncome + federal.taxableLTCG;
    }

    it("calculates tax at 4.4% flat rate correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncomeForYear(inputs);
      const result = calculateColoradoTax(
        inputs,
        data.coloradoBrackets,
        data.sharedLimits,
        data.coloradoLimits,
        federalTaxableIncome,
        data.ficaData,
      );

      // Federal standard deduction varies by year
      const expectedStdDeduction = {
        "2025": 15750,
        "2026": 16100,
      };
      const expectedTaxableIncome = 100000 - expectedStdDeduction[year];
      const expectedTax = Math.round(expectedTaxableIncome * 0.044);

      expect(result.taxableOrdinaryIncome).toBe(expectedTaxableIncome);
      expect(result.ordinaryIncomeTax).toBeCloseTo(expectedTax, 0);
    });

    it("uses flat 4.4% rate (unchanged across years)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federalTaxableIncome = getFederalTaxableIncomeForYear(inputs);
      const result = calculateColoradoTax(
        inputs,
        data.coloradoBrackets,
        data.sharedLimits,
        data.coloradoLimits,
        federalTaxableIncome,
        data.ficaData,
      );

      // Verify the bracket shows 4.4%
      expect(result.ordinaryIncomeBracketBreakdown.length).toBe(1);
      expect(result.ordinaryIncomeBracketBreakdown[0].rate).toBe(0.044);
    });
  },
);
