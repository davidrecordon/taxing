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

// Helper to get the federal result Colorado starts from
function getFederalResult(inputs: ReturnType<typeof createDefaultInputs>) {
  const federal = calculateFederalTax(
    inputs,
    federalBrackets,
    ltcgBrackets,
    federalDeductions,
    sharedLimits,
    federalLimits,
    ficaData,
  );
  return federal;
}

describe("calculateColoradoTax", () => {
  describe("flat rate calculation", () => {
    it("calculates tax at 4.4% flat rate on federal taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      // Federal taxable income = $100k - $16,100 standard deduction = $83,900
      // Colorado tax = $83,900 * 4.4% = $3,691.60
      expect(result.taxableOrdinaryIncome).toBe(83900);
      expect(result.ordinaryIncomeTax).toBeCloseTo(3691.6, 0);
      expect(result.totalTax).toBeCloseTo(3691.6, 0);
    });

    it("uses federal taxable income for all filing statuses", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "colorado",
        filingStatus: "marriedFilingJointly",
      });

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      // Federal taxable income = $100k - $32,200 standard deduction (MFJ) = $67,800
      // Colorado tax = $67,800 * 4.4% = $2,983.20
      expect(result.taxableOrdinaryIncome).toBe(67800);
      expect(result.ordinaryIncomeTax).toBeCloseTo(2983.2, 0);
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

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      // Gross = $100k, less $16,100 std deduction = $83,900 federal taxable
      expect(result.taxableOrdinaryIncome).toBe(83900);
      expect(result.ltcgTax).toBe(0); // No separate LTCG treatment
    });
  });

  describe("safe harbor", () => {
    it("calculates safe harbor correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTax: 4000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      expect(result.safeHarbor).toBeDefined();
      // Colorado requires 70% of current year tax
      expect(result.safeHarbor!.currentYear90Percent).toBeCloseTo(
        result.totalTax * 0.7,
        2,
      );
      // 110% of prior year tax (last year's income assumed over $150,000)
      expect(result.safeHarbor!.priorYearSafeHarbor).toBeCloseTo(4400, 2);
    });

    it("is met by paying 70% of this year's tax", () => {
      // $100,000 wages: Colorado tax is 4.4% x $83,900 = $3,691.60
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 2600,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        getFederalResult(inputs),
        ficaData,
      );

      expect(result.safeHarbor!.minimum).toBeCloseTo(2584.12, 2);
      expect(result.safeHarbor!.met).toBe(true);
    });

    it("requires 100% of last year's tax when last year's income was not over $150,000", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTax: 4000,
        priorYearIncomeOverThreshold: false,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        getFederalResult(inputs),
        ficaData,
      );

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

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      expect(result.totalPaid).toBe(3000);
      // Tax = ~$3,691.60, paid $3,000, owed ~$691.60
      expect(result.remainingOwed).toBeCloseTo(691.6, 0);
      expect(result.refundDue).toBe(0);
    });

    it("calculates refund correctly when overpaid", () => {
      const inputs = createDefaultInputs({
        federalIncome: 50000,
        stateTaxWithheld: 3000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      // Tax = ~$1,491.60 ($33,900 * 4.4%), paid $3,000
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
        getFederalResult(inputs),
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

      const federal = getFederalResult(inputs);
      const result = calculateColoradoTax(
        inputs,
        coloradoBrackets,
        sharedLimits,
        coloradoLimits,
        federal,
        ficaData,
      );

      // Charitable giving counts above the $1,000 floor (0.5% of AGI)
      // $200k - $39k itemized = $161k federal taxable
      // Colorado tax = $161k * 4.4% = $7,084
      expect(result.taxableOrdinaryIncome).toBe(161000);
      expect(result.ordinaryIncomeTax).toBeCloseTo(7084, 0);
    });
  });
});

describe("calculateColoradoTax additions and subtractions", () => {
  const calculateForYear = (
    year: TaxYear,
    overrides: Parameters<typeof createDefaultInputs>[0],
  ) => {
    const data = loadTestDataForYear(year);
    const inputs = createDefaultInputs({
      selectedState: "colorado",
      ...overrides,
    });
    const federal = calculateFederalTax(
      inputs,
      data.federalBrackets,
      data.ltcgBrackets,
      data.federalDeductions,
      data.sharedLimits,
      data.federalLimits,
      data.ficaData,
    );
    return calculateColoradoTax(
      inputs,
      data.coloradoBrackets,
      data.sharedLimits,
      data.coloradoLimits,
      federal,
      data.ficaData,
    );
  };

  it("adds back state income tax deducted on the federal return", () => {
    // 2025 single: itemized $24,000 ($10,000 SALT + $12,000 + $2,000) vs
    // $15,750 standard, federal taxable $126,000.
    // Addback: min($10,000 SALT - $4,000 property tax, $24,000 - $15,750)
    const result = calculateForYear("2025", {
      federalIncome: 150000,
      stateTaxWithheld: 6000,
      propertyTaxesPaid: 4000,
      mortgageInterestPaid: 12000,
      charitableContributions: 2000,
      filingStatus: "single",
    });

    expect(result.coloradoAdjustments!.federalTaxableIncome).toBe(126000);
    expect(result.coloradoAdjustments!.deductionAddback).toBe(6000);
    expect(result.taxableOrdinaryIncome).toBe(132000);
    expect(result.totalTax).toBeCloseTo(5808, 2);
  });

  it("limits the state income tax addback to the benefit of itemizing", () => {
    // 2025 single: itemized $17,000 vs $15,750 standard, so only $1,250
    const result = calculateForYear("2025", {
      federalIncome: 150000,
      stateTaxWithheld: 6000,
      mortgageInterestPaid: 11000,
      filingStatus: "single",
    });

    expect(result.coloradoAdjustments!.deductionAddback).toBe(1250);
  });

  it("adds back the standard deduction above the limit at $300,000 of AGI", () => {
    // MFJ, AGI $400,000: 2025 $31,500 - $16,000; 2026 $32,200 - $2,000
    const inputs = {
      federalIncome: 400000,
      filingStatus: "marriedFilingJointly" as const,
    };

    expect(
      calculateForYear("2025", inputs).coloradoAdjustments!.deductionAddback,
    ).toBe(15500);
    expect(
      calculateForYear("2026", inputs).coloradoAdjustments!.deductionAddback,
    ).toBe(30200);
  });

  it("does not add back the standard deduction below $300,000 of AGI", () => {
    const result = calculateForYear("2026", {
      federalIncome: 299999,
      filingStatus: "single",
    });

    expect(result.coloradoAdjustments!.deductionAddback).toBe(0);
  });

  it("uses the larger of the two addbacks for a high-income itemizer", () => {
    // 2025 MFJ, AGI $600,000: SALT cap $10,000, itemized $50,000, federal
    // taxable $550,000. State tax addback is $0 (property tax uses the cap);
    // high-income addback is $50,000 - $16,000 = $34,000.
    const result = calculateForYear("2025", {
      federalIncome: 600000,
      stateTaxWithheld: 25000,
      propertyTaxesPaid: 15000,
      mortgageInterestPaid: 25000,
      charitableContributions: 15000,
      filingStatus: "marriedFilingJointly",
    });

    expect(result.coloradoAdjustments!.deductionAddback).toBe(34000);
    expect(result.taxableOrdinaryIncome).toBe(584000);
    expect(result.totalTax).toBeCloseTo(25696, 2);
  });

  it("subtracts charitable contributions over $500 for non-itemizers", () => {
    const result = calculateForYear("2025", {
      federalIncome: 120000,
      charitableContributions: 3000,
      filingStatus: "marriedFilingJointly",
    });

    expect(result.coloradoAdjustments!.charitableSubtraction).toBe(2500);
    // $120,000 - $31,500 standard - $2,500
    expect(result.taxableOrdinaryIncome).toBe(86000);
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

    // Helper to get the federal result for a specific year
    function getFederalResultForYear(
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
      return federal;
    }

    it("calculates tax at 4.4% flat rate correctly", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "colorado",
        filingStatus: "single",
      });

      const federal = getFederalResultForYear(inputs);
      const result = calculateColoradoTax(
        inputs,
        data.coloradoBrackets,
        data.sharedLimits,
        data.coloradoLimits,
        federal,
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

      const federal = getFederalResultForYear(inputs);
      const result = calculateColoradoTax(
        inputs,
        data.coloradoBrackets,
        data.sharedLimits,
        data.coloradoLimits,
        federal,
        data.ficaData,
      );

      // Verify the bracket shows 4.4%
      expect(result.ordinaryIncomeBracketBreakdown.length).toBe(1);
      expect(result.ordinaryIncomeBracketBreakdown[0].rate).toBe(0.044);
    });
  },
);
