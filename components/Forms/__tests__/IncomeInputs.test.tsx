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
