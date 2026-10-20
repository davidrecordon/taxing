import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DeductionInputs from "../DeductionInputs";
import { CharitableScenario } from "@/lib/charitableScenario";
import { TaxInputs } from "@/lib/types";
import {
  createDefaultInputs,
  federalLimits,
  sharedLimits,
} from "@/lib/__tests__/testData";

const renderDeductions = (
  overrides: Partial<TaxInputs> = {},
  calculateCharitableScenario?: (contributions: number) => CharitableScenario,
  onUpdate = vi.fn(),
) =>
  render(
    <DeductionInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={onUpdate}
      sharedLimits={sharedLimits}
      federalLimits={federalLimits}
      federalAgi={200000}
      calculateCharitableScenario={calculateCharitableScenario}
    />,
  );

// Giving saves 30 cents per dollar above a threshold, and nothing below it
const scenarioSavingAbove =
  (threshold: number, overrides: Partial<CharitableScenario> = {}) =>
  (contributions: number): CharitableScenario => ({
    federalTax: 40000 - Math.max(0, contributions - threshold) * 0.3,
    stateTax: 0,
    federalFloor: 0,
    federalItemizes: true,
    standardChosenForStateTax: false,
    federalHighIncomeReduction: 0,
    stateHighIncomeReduction: 0,
    ...overrides,
  });

const olderLoanLabel = "Loan is from before December 16, 2017";

describe("DeductionInputs", () => {
  describe("mortgage balance sub-field", () => {
    it("is hidden until mortgage interest is entered", () => {
      renderDeductions();

      expect(screen.getByText("Mortgage Interest Paid")).toBeInTheDocument();
      expect(screen.queryByText("Mortgage Balance")).not.toBeInTheDocument();
    });

    it("appears once mortgage interest has a value", () => {
      renderDeductions({ mortgageInterestPaid: 20000 });

      expect(screen.getByText("Mortgage Balance")).toBeInTheDocument();
    });

    it("stays visible while it holds a value of its own", () => {
      renderDeductions({ mortgageInterestPaid: 0, mortgageBalance: 500000 });

      expect(screen.getByText("Mortgage Balance")).toBeInTheDocument();
    });
  });

  describe("older loan checkbox", () => {
    it("is hidden when the balance is within the standard limit", () => {
      renderDeductions({
        mortgageInterestPaid: 20000,
        mortgageBalance: 750000,
      });

      expect(screen.queryByText(olderLoanLabel)).not.toBeInTheDocument();
    });

    it("appears when the balance is over the standard limit", () => {
      renderDeductions({
        mortgageInterestPaid: 40000,
        mortgageBalance: 900000,
      });

      expect(screen.getByText(olderLoanLabel)).toBeInTheDocument();
      expect(
        screen.getByText(/prorated based on mortgage limits/),
      ).toBeInTheDocument();
    });

    it("removes the proration warning when the older limit covers the balance", () => {
      renderDeductions({
        mortgageInterestPaid: 40000,
        mortgageBalance: 900000,
        isMortgageGrandfathered: true,
      });

      expect(screen.getByRole("checkbox")).toBeChecked();
      expect(
        screen.queryByText(/prorated based on mortgage limits/),
      ).not.toBeInTheDocument();
    });
  });

  describe("property tax warning", () => {
    it("warns when property tax exceeds the Federal SALT cap", () => {
      renderDeductions({ propertyTaxesPaid: 50000 });

      expect(
        screen.getByText(/limited to the \$40,400 Federal SALT deduction/),
      ).toBeInTheDocument();
    });
  });

  describe("charitable what-if button", () => {
    const button = () => screen.queryByRole("button", { name: "What if..." });

    it("is hidden when no giving is entered", () => {
      renderDeductions({}, scenarioSavingAbove(0));

      expect(button()).not.toBeInTheDocument();
    });

    it("appears once the giving entered reduces tax", () => {
      renderDeductions(
        { charitableContributions: 10000 },
        scenarioSavingAbove(0),
      );

      expect(button()).toBeInTheDocument();
      expect(
        screen.queryByText(/does not reduce your tax/),
      ).not.toBeInTheDocument();
    });

    it("opens the tool, and returns focus to the button when it closes", async () => {
      renderDeductions(
        { charitableContributions: 10000 },
        scenarioSavingAbove(0),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await userEvent.click(button()!);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
    });

    it("applies an amount chosen in the tool to the field", async () => {
      const onUpdate = vi.fn();
      renderDeductions(
        { charitableContributions: 10000 },
        scenarioSavingAbove(0),
        onUpdate,
      );

      await userEvent.click(button()!);
      await userEvent.click(
        screen.getByRole("button", { name: "Use $20,000" }),
      );

      expect(onUpdate).toHaveBeenCalledWith("charitableContributions", 20000);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("is replaced by a hint while the standard deduction is still larger", () => {
      renderDeductions(
        { charitableContributions: 2000 },
        scenarioSavingAbove(5000, { federalItemizes: false }),
      );

      expect(button()).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /does not reduce your tax yet: the standard deduction is still larger/,
        ),
      ).toBeInTheDocument();
    });

    it("explains when the state keeps both returns on the standard deduction", () => {
      renderDeductions(
        { charitableContributions: 2000, selectedState: "dc" },
        scenarioSavingAbove(5000, {
          federalItemizes: false,
          standardChosenForStateTax: true,
        }),
      );

      expect(button()).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /taking the standard deduction is still better for your Federal and District of Columbia tax combined/,
        ),
      ).toBeInTheDocument();
    });

    it("explains when the giving is under the Federal floor", () => {
      renderDeductions(
        { charitableContributions: 800 },
        scenarioSavingAbove(1000, { federalFloor: 1000 }),
      );

      expect(button()).not.toBeInTheDocument();
      expect(
        screen.getByText(
          /the first \$1,000 of giving each year is not deductible/,
        ),
      ).toBeInTheDocument();
    });
  });
});
