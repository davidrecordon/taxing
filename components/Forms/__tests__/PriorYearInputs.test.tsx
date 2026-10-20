import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PriorYearInputs from "../PriorYearInputs";
import { TaxInputs } from "@/lib/types";
import { createDefaultInputs } from "@/lib/__tests__/testData";

const renderPriorYear = (overrides: Partial<TaxInputs> = {}) =>
  render(
    <PriorYearInputs
      inputs={createDefaultInputs(overrides)}
      onUpdate={vi.fn()}
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
});
