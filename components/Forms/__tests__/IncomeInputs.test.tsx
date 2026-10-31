import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import IncomeInputs from "../IncomeInputs";
import { TaxInputs } from "@/lib/types";
import { createDefaultInputs, sharedLimits } from "@/lib/__tests__/testData";

const renderIncome = (
  overrides: Partial<TaxInputs> = {},
  onUpdate = vi.fn(),
) =>
  render(
    <IncomeInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={onUpdate}
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

  describe("bonuses and stock sub-field", () => {
    const label = "Of which Bonuses & Stock";

    it("is hidden until wages are entered", () => {
      renderIncome();

      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });

    it("appears once wages have a value", () => {
      renderIncome({ federalIncome: 250000 });

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(
        screen.getByText(/Only affects the withholding estimate/),
      ).toBeInTheDocument();
    });

    it("stays visible while it holds a value of its own, and warns", () => {
      renderIncome({ federalIncome: 0, supplementalWages: 50000 });

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(/Cannot exceed wages/)).toBeInTheDocument();
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

  describe("typing in a field", () => {
    // Sub-fields are rendered by giving their parent field a value
    it.each<[string, keyof TaxInputs, Partial<TaxInputs>]>([
      ["Wages & Other Income", "federalIncome", {}],
      ["California Income", "stateIncome", {}],
      ["Self-Employment Income", "selfEmploymentIncome", {}],
      ["Interest", "interestIncome", {}],
      ["Of which U.S. Treasury", "treasuryInterest", { interestIncome: 9000 }],
      ["Of which Bonuses & Stock", "supplementalWages", { federalIncome: 9000 }],
      ["Ordinary Dividends", "ordinaryDividends", {}],
      ["Qualified Dividends", "qualifiedDividends", { ordinaryDividends: 9000 }],
      ["Short-Term Capital Gains", "shortTermCapitalGains", {}],
      ["Long-Term Capital Gains", "longTermCapitalGains", {}],
    ])("%s updates %s", async (label, field, overrides) => {
      const onUpdate = vi.fn();
      renderIncome(overrides, onUpdate);

      await userEvent.type(screen.getByLabelText(label), "5000");

      expect(onUpdate).toHaveBeenLastCalledWith(field, 5000);
    });
  });
});
