import { describe, it, expect } from "vitest";
import { calculateFloridaTax } from "../states/floridaTaxCalculator";
import { TaxInputs } from "../types";
import { createDefaultInputs } from "./testData";

// Florida has no personal income tax. The calculator reports income for
// display and returns any state payments as a refund.
const calculate = (overrides: Partial<TaxInputs> = {}) =>
  calculateFloridaTax(
    createDefaultInputs({ selectedState: "florida", ...overrides }),
  );

describe("calculateFloridaTax", () => {
  describe("no income tax", () => {
    it.each([
      "single",
      "marriedFilingJointly",
      "marriedFilingSeparately",
    ] as const)("%s: charges no tax on any kind of income", (filingStatus) => {
      const result = calculate({
        filingStatus,
        federalIncome: 1000000,
        selfEmploymentIncome: 200000,
        interestIncome: 50000,
        ordinaryDividends: 50000,
        shortTermCapitalGains: 500000,
        longTermCapitalGains: 2000000,
      });

      expect(result.taxableOrdinaryIncome).toBe(0);
      expect(result.taxableLTCG).toBe(0);
      expect(result.ordinaryIncomeBracketBreakdown).toEqual([]);
      expect(result.ltcgBracketBreakdown).toEqual([]);
      expect(result.ordinaryIncomeTax).toBe(0);
      expect(result.ltcgTax).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe("payments", () => {
    it("returns state withholding and estimated payments as a refund", () => {
      // Paid $2,000 + $1,000 = $3,000 against $0 of tax
      const result = calculate({
        federalIncome: 100000,
        stateTaxWithheld: 2000,
        stateEstimatedPaid: 1000,
      });

      expect(result.withheld).toBe(2000);
      expect(result.estimatedPaid).toBe(1000);
      expect(result.totalPaid).toBe(3000);
      expect(result.refundDue).toBe(3000);
      expect(result.remainingOwed).toBe(0);
    });
  });

  describe("safe harbor", () => {
    it("has none, even when last year's state tax is entered", () => {
      const result = calculate({
        federalIncome: 100000,
        priorYearStateTax: 5000,
      });

      expect(result.safeHarbor).toBeUndefined();
    });
  });

  describe("gross income", () => {
    it("reports wages, self-employment income, interest, dividends and gains", () => {
      // $100,000 wages + $40,000 self-employment + $5,000 interest
      // + $3,000 dividends + $20,000 short-term + $30,000 long-term = $198,000
      const result = calculate({
        federalIncome: 100000,
        selfEmploymentIncome: 40000,
        interestIncome: 5000,
        ordinaryDividends: 3000,
        shortTermCapitalGains: 20000,
        longTermCapitalGains: 30000,
      });

      expect(result.wageIncome).toBe(100000);
      expect(result.interestIncome).toBe(5000);
      expect(result.ordinaryDividends).toBe(3000);
      expect(result.grossIncome).toBe(198000);
    });

    it("does not subtract this year's capital losses", () => {
      // $100,000 of wages; the $20,000 and $30,000 losses are left out
      const result = calculate({
        federalIncome: 100000,
        shortTermCapitalGains: -20000,
        longTermCapitalGains: -30000,
      });

      expect(result.grossIncome).toBe(100000);
    });

    it("uses state income rather than federal income when both are entered", () => {
      const result = calculate({
        federalIncome: 120000,
        stateIncome: 100000,
      });

      expect(result.wageIncome).toBe(100000);
      expect(result.grossIncome).toBe(100000);
    });
  });

  describe("zero and empty inputs", () => {
    it("returns zero for everything when nothing is entered", () => {
      const result = calculate();

      expect(result.grossIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.totalPaid).toBe(0);
      expect(result.remainingOwed).toBe(0);
      expect(result.refundDue).toBe(0);
    });
  });
});
