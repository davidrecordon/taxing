import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PriorYearInputs from "../PriorYearInputs";
import { TaxInputs } from "@/lib/types";
import { createDefaultInputs, sharedLimits } from "@/lib/__tests__/testData";

const renderPriorYear = (overrides: Partial<TaxInputs> = {}) =>
  render(
    <PriorYearInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={vi.fn()}
      sharedLimits={sharedLimits}
    />,
  );

describe("PriorYearInputs", () => {
  it("asks for last year's total tax, not the amount paid", () => {
    renderPriorYear({ selectedState: "california" });

    expect(screen.getByText("Last year's Federal tax")).toBeInTheDocument();
    expect(screen.getByText("Last year's California tax")).toBeInTheDocument();
    expect(screen.queryByText(/Tax Paid/)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/not what you paid at filing or your refund/),
    ).toHaveLength(2);
  });

  it("labels the state field for the selected state", () => {
    renderPriorYear({ selectedState: "newyork" });

    expect(screen.getByText("Last year's New York tax")).toBeInTheDocument();
  });

  describe("state balance paid sub-field", () => {
    it("is hidden until last year's state tax is entered", () => {
      renderPriorYear({ priorYearFederalTax: 20000 });

      expect(
        screen.queryByText(/balance paid this year/),
      ).not.toBeInTheDocument();
    });

    it("appears once last year's state tax has a value", () => {
      renderPriorYear({ priorYearStateTax: 9000, selectedState: "newyork" });

      expect(
        screen.getByText("New York balance paid this year"),
      ).toBeInTheDocument();
    });

    it("is not offered where the state has no income tax", () => {
      renderPriorYear({ priorYearStateTax: 9000, selectedState: "florida" });

      expect(
        screen.queryByText(/balance paid this year/),
      ).not.toBeInTheDocument();
    });
  });

  describe("last year's income checkbox", () => {
    it("is hidden until a prior-year tax is entered", () => {
      renderPriorYear();

      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("appears ticked once a prior-year tax is entered", () => {
      renderPriorYear({ priorYearFederalTax: 20000 });

      expect(
        screen.getByText(/Last year's income was over\s+\$150,000/),
      ).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("uses $75,000 when married filing separately", () => {
      renderPriorYear({
        priorYearStateTax: 5000,
        filingStatus: "marriedFilingSeparately",
      });

      expect(
        screen.getByText(/Last year's income was over\s+\$75,000/),
      ).toBeInTheDocument();
    });

    it("reflects an unticked answer", () => {
      renderPriorYear({
        priorYearFederalTax: 20000,
        priorYearIncomeOverThreshold: false,
      });

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });
  });
});
