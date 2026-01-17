import { describe, it, expect } from "vitest";
import { calculateFloridaTax } from "../states/floridaTaxCalculator";
import { createDefaultInputs } from "./testData";

describe("calculateFloridaTax", () => {
  describe("no income tax", () => {
    it("returns zero tax for any income amount", () => {
      const inputs = createDefaultInputs({
        federalIncome: 1000000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.totalTax).toBe(0);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.ltcgTax).toBe(0);
    });

    it("returns zero tax regardless of filing status", () => {
      const statuses = [
        "single",
        "marriedFilingJointly",
        "marriedFilingSeparately",
      ] as const;

      for (const filingStatus of statuses) {
        const inputs = createDefaultInputs({
          federalIncome: 100000,
          selectedState: "florida",
          filingStatus,
        });

        const result = calculateFloridaTax(inputs);
        expect(result.totalTax).toBe(0);
      }
    });

    it("returns zero tax with capital gains", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        shortTermCapitalGains: 50000,
        longTermCapitalGains: 100000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.totalTax).toBe(0);
      expect(result.grossIncome).toBe(250000);
    });
  });

  describe("payment handling", () => {
    it("returns full refund when withholding is present", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 5000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.totalTax).toBe(0);
      expect(result.totalPaid).toBe(5000);
      expect(result.refundDue).toBe(5000);
      expect(result.remainingOwed).toBe(0);
    });

    it("returns full refund when estimated payments are present", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateEstimatedPaid: 3000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.totalTax).toBe(0);
      expect(result.totalPaid).toBe(3000);
      expect(result.refundDue).toBe(3000);
      expect(result.remainingOwed).toBe(0);
    });

    it("returns combined refund for withholding and estimated", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        stateTaxWithheld: 2000,
        stateEstimatedPaid: 1000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.totalTax).toBe(0);
      expect(result.totalPaid).toBe(3000);
      expect(result.refundDue).toBe(3000);
    });
  });

  describe("edge cases", () => {
    it("handles zero income", () => {
      const inputs = createDefaultInputs({
        selectedState: "florida",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
    });

    it("does not include safe harbor (no tax to safe harbor against)", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        priorYearStateTaxPaid: 5000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.safeHarbor).toBeUndefined();
    });

    it("returns zero taxable income", () => {
      const inputs = createDefaultInputs({
        federalIncome: 100000,
        selectedState: "florida",
        filingStatus: "single",
      });

      const result = calculateFloridaTax(inputs);

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(0);
    });
  });
});
