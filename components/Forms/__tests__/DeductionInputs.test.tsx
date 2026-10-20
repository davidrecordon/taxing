import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeductionInputs from "../DeductionInputs";
import { TaxInputs } from "@/lib/types";
import {
  createDefaultInputs,
  federalLimits,
  sharedLimits,
} from "@/lib/__tests__/testData";

const renderDeductions = (overrides: Partial<TaxInputs> = {}) =>
  render(
    <DeductionInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={vi.fn()}
      sharedLimits={sharedLimits}
      federalLimits={federalLimits}
      federalAgi={200000}
    />,
  );

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
});
