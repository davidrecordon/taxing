import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import IncomeInputs from "../IncomeInputs";
import { TaxInputs } from "@/lib/types";
import { createDefaultInputs, sharedLimits } from "@/lib/__tests__/testData";

const renderIncome = (overrides: Partial<TaxInputs> = {}) =>
  render(
    <IncomeInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={vi.fn()}
      sharedLimits={sharedLimits}
    />,
  );

describe("IncomeInputs", () => {
  describe("qualified dividends sub-field", () => {
    it("is hidden until ordinary dividends are entered", () => {
      renderIncome();

      expect(screen.getByText("Ordinary Dividends")).toBeInTheDocument();
      expect(screen.queryByText("Qualified Dividends")).not.toBeInTheDocument();
    });

    it("appears once ordinary dividends have a value", () => {
      renderIncome({ ordinaryDividends: 8000 });

      expect(screen.getByText("Qualified Dividends")).toBeInTheDocument();
    });

    it("stays visible while it holds a value of its own", () => {
      renderIncome({ ordinaryDividends: 0, qualifiedDividends: 5000 });

      expect(screen.getByText("Qualified Dividends")).toBeInTheDocument();
      expect(
        screen.getByText(/Cannot exceed ordinary dividends/),
      ).toBeInTheDocument();
    });
  });

  describe("U.S. Treasury interest sub-field", () => {
    const label = "Of which U.S. Treasury";

    it("is hidden until interest is entered", () => {
      renderIncome();

      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });

    it("appears once interest has a value", () => {
      renderIncome({ interestIncome: 5000, selectedState: "california" });

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(/Not taxed by California/)).toBeInTheDocument();
    });

    it("warns when it exceeds total interest", () => {
      renderIncome({ interestIncome: 5000, treasuryInterest: 9000 });

      expect(screen.getByText(/Cannot exceed interest/)).toBeInTheDocument();
    });

    it("is not offered where the state has no income tax", () => {
      renderIncome({ interestIncome: 5000, selectedState: "florida" });
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });

    it("is not offered for Washington", () => {
      renderIncome({ interestIncome: 5000, selectedState: "washington" });
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  describe("capital loss hint", () => {
    it("shows the $3,000 limit for a negative entry", () => {
      renderIncome({ longTermCapitalGains: -5000 });

      expect(
        screen.getByText(/up to \$3,000 of other income/),
      ).toBeInTheDocument();
    });

    it("shows the $1,500 limit when married filing separately", () => {
      renderIncome({
        longTermCapitalGains: -5000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(
        screen.getByText(/up to \$1,500 of other income/),
      ).toBeInTheDocument();
    });
  });
});
