import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FederalBreakdown from "../FederalBreakdown";
import { TaxCalculationResult } from "@/lib/types";
import { TAX_YEAR } from "@/lib/config";
import {
  calculateResults,
  rowText,
} from "../../States/__tests__/calculateResults";

const createMockResult = (
  overrides: Partial<TaxCalculationResult> = {},
): TaxCalculationResult => ({
  wageIncome: 100000,
  shortTermCapitalGains: 0,
  longTermCapitalGains: 0,
  grossIncome: 100000,
  shortTermLossCarryoverOffset: 0,
  longTermLossCarryoverOffset: 0,
  contributions401k: 0,
  preTaxMedical: 0,
  adjustedGrossIncome: 84300,
  deductionBreakdown: {
    standardDeduction: 15700,
    itemizedDeduction: 0,
    deductionUsed: "standard",
    deductionAmount: 15700,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
  },
  taxableOrdinaryIncome: 84300,
  taxableLTCG: 0,
  ordinaryIncomeBracketBreakdown: [
    {
      bracketMin: 0,
      bracketMax: 11925,
      rate: 0.1,
      incomeInBracket: 11925,
      taxForBracket: 1192.5,
    },
    {
      bracketMin: 11925,
      bracketMax: 48475,
      rate: 0.12,
      incomeInBracket: 36550,
      taxForBracket: 4386,
    },
    {
      bracketMin: 48475,
      bracketMax: 103350,
      rate: 0.22,
      incomeInBracket: 35825,
      taxForBracket: 7881.5,
    },
  ],
  ltcgBracketBreakdown: [],
  ordinaryIncomeTax: 13460,
  ltcgTax: 0,
  totalTax: 21110,
  withheld: 15000,
  estimatedPaid: 0,
  totalPaid: 15000,
  remainingOwed: 6110,
  refundDue: 0,
  ficaBreakdown: {
    socialSecurityTax: 6200,
    socialSecurityWages: 100000,
    medicareTax: 1450,
    additionalMedicareTax: 0,
    totalFica: 7650,
  },
  ...overrides,
});

describe("FederalBreakdown", () => {
  describe("income section", () => {
    it("displays wage income", () => {
      const result = createMockResult({ wageIncome: 150000 });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText("Wages & Other Income")).toBeInTheDocument();
      expect(screen.getByText("$150,000")).toBeInTheDocument();
    });

    it("shows short-term capital gains when present", () => {
      const result = createMockResult({
        shortTermCapitalGains: 10000,
        grossIncome: 110000,
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText("Short-Term Capital Gains")).toBeInTheDocument();
    });

    it("shows long-term capital gains when present", () => {
      const result = createMockResult({
        longTermCapitalGains: 20000,
        grossIncome: 120000,
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText("Long-Term Capital Gains")).toBeInTheDocument();
    });

    it("shows gross income total", () => {
      const result = createMockResult({ grossIncome: 125000 });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText("Gross Income")).toBeInTheDocument();
    });
  });

  describe("deductions", () => {
    it("shows standard deduction when used", () => {
      const result = createMockResult();
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText("Less: Standard Deduction")).toBeInTheDocument();
    });

    it("shows itemized deduction when used", () => {
      const result = createMockResult({
        deductionBreakdown: {
          standardDeduction: 15700,
          itemizedDeduction: 25000,
          deductionUsed: "itemized",
          deductionAmount: 25000,
          saltDeduction: 10000,
          saltCapped: true,
          mortgageInterest: 10000,
          charitableContributions: 5000,
        },
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText("Less: Itemized Deduction")).toBeInTheDocument();
      expect(
        screen.getByText("Itemized Deduction Breakdown:"),
      ).toBeInTheDocument();
    });

    it("shows 401k contributions when present", () => {
      const result = createMockResult({ contributions401k: 23000 });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("Less: 401(k) Contributions"),
      ).toBeInTheDocument();
    });
  });

  describe("loss carryovers", () => {
    it("shows short-term loss offset when present", () => {
      const result = createMockResult({ shortTermLossCarryoverOffset: 5000 });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("Less: Short-Term Loss Offset"),
      ).toBeInTheDocument();
    });

    it("shows long-term loss offset when present", () => {
      const result = createMockResult({ longTermLossCarryoverOffset: 10000 });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("Less: Long-Term Loss Offset"),
      ).toBeInTheDocument();
    });

    it("shows unused ST loss carried over when applicable", () => {
      const result = createMockResult({
        shortTermLossCarryoverOffset: 5000,
        shortTermLossCarryoverUnused: 2000,
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText(/ST loss\s+carries over to next year/),
      ).toBeInTheDocument();
    });
  });

  describe("FICA taxes", () => {
    it("displays FICA breakdown", () => {
      const result = createMockResult();
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("FICA Taxes (Social Security & Medicare)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Total FICA")).toBeInTheDocument();
    });

    it("shows additional Medicare when applicable", () => {
      const result = createMockResult({
        ficaBreakdown: {
          socialSecurityTax: 10918.2,
          socialSecurityWages: 176100,
          medicareTax: 3625,
          additionalMedicareTax: 450,
          totalFica: 14993.2,
        },
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText(/Additional Medicare/)).toBeInTheDocument();
    });
  });

  describe("bracket tables", () => {
    it("displays ordinary income bracket table", () => {
      const result = createMockResult();
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("Ordinary Income Tax by Bracket"),
      ).toBeInTheDocument();
    });

    it("displays LTCG bracket table when there are gains", () => {
      const result = createMockResult({
        longTermCapitalGains: 50000,
        taxableLTCG: 50000,
        ltcgBracketBreakdown: [
          {
            bracketMin: 0,
            bracketMax: 47025,
            rate: 0,
            incomeInBracket: 47025,
            taxForBracket: 0,
          },
          {
            bracketMin: 47025,
            bracketMax: 518900,
            rate: 0.15,
            incomeInBracket: 2975,
            taxForBracket: 446.25,
          },
        ],
        ltcgTax: 446.25,
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("Long-Term Capital Gains Tax by Bracket"),
      ).toBeInTheDocument();
    });
  });

  describe("safe harbor", () => {
    it("shows safe harbor section when tax is owed", () => {
      const result = createMockResult({
        remainingOwed: 5000,
        safeHarbor: {
          currentYear90Percent: 18999,
          priorYearSafeHarbor: 16500,
          minimum: 16500,
          met: false,
          remaining: 1500,
        },
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(
        screen.getByText("Safe Harbor (Penalty Avoidance)"),
      ).toBeInTheDocument();
    });

    it("shows safe harbor met message when criteria satisfied", () => {
      const result = createMockResult({
        remainingOwed: 1000,
        safeHarbor: {
          currentYear90Percent: 18999,
          priorYearSafeHarbor: 16500,
          minimum: 16500,
          met: true,
          remaining: 0,
        },
      });
      render(<FederalBreakdown result={result} taxYear={TAX_YEAR} />);

      expect(screen.getByText(/Safe Harbor Met/)).toBeInTheDocument();
    });
  });

  describe("with calculated results", () => {
    const renderFederal = (
      overrides: Parameters<typeof calculateResults>[1],
    ) => {
      const { federal } = calculateResults("california", overrides);
      render(<FederalBreakdown result={federal} taxYear={TAX_YEAR} />);
      return federal;
    };

    it("shows the Additional Medicare tax on self-employment earnings in the SE tax total", () => {
      // $300,000 of business income: self-employment tax $30,912.45 plus
      // Additional Medicare $693.45 = $31,605.90
      renderFederal({ selfEmploymentIncome: 300000 });

      expect(rowText(/Additional Medicare/)).toContain("$693");
      expect(rowText("Total SE Tax")).toContain("$31,606");
    });

    it("leaves the Additional Medicare row out when none is due", () => {
      renderFederal({ selfEmploymentIncome: 100000 });

      expect(screen.queryByText(/Additional Medicare/)).not.toBeInTheDocument();
    });

    it("keeps payroll tax out of the Federal tax total", () => {
      // $100,000 wages: income tax $13,170; FICA $7,650 is informational
      renderFederal({ federalIncome: 100000, federalTaxWithheld: 13170 });

      expect(rowText("Total FICA")).toContain("$7,650");
      expect(
        screen.getByText(/Not included in the\s+Federal tax total below/),
      ).toBeInTheDocument();
      expect(rowText("Total Federal Tax")).toContain("$13,170");
      expect(screen.getByText("No Tax Due")).toBeInTheDocument();
    });

    it("shows AGI before the deduction and taxable income after it", () => {
      renderFederal({
        federalIncome: 100000,
        longTermCapitalGains: 10000,
        contributions401k: 20000,
      });

      expect(rowText("Adjusted Gross Income (AGI)")).toContain("$90,000");
      // $90,000 less the $16,100 standard deduction
      expect(rowText("Taxable Income")).toContain("$73,900");
    });

    it("shows the charitable floor and the overall limitation when itemizing", () => {
      // MFJ, AGI $1,000,000: charity $45,000 less the $5,000 floor, and
      // $80,000 of deductions reduced by 2/37
      renderFederal({
        federalIncome: 1000000,
        stateTaxWithheld: 60000,
        mortgageInterestPaid: 30000,
        charitableContributions: 45000,
        filingStatus: "marriedFilingJointly",
      });

      expect(rowText("SALT (capped)")).toContain("$10,000");
      expect(
        rowText(/Charitable Contributions\s+\(above the AGI floor\)/),
      ).toContain("$40,000");
      expect(rowText("Less: High-Income Limitation")).toContain("-$4,324");
      expect(rowText("Taxable Income")).toContain("$924,324");
    });
  });
});
