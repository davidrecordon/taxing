import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ItemizedDeductionDetails from "../ItemizedDeductionDetails";
import { DeductionBreakdown } from "@/lib/types";

const createBreakdown = (
  overrides: Partial<DeductionBreakdown> = {},
): DeductionBreakdown => ({
  standardDeduction: 16100,
  itemizedDeduction: 40000,
  deductionUsed: "itemized",
  deductionAmount: 40000,
  saltDeduction: 10000,
  saltCapped: true,
  mortgageInterest: 20000,
  charitableContributions: 10000,
  ...overrides,
});

describe("ItemizedDeductionDetails", () => {
  it("renders nothing when the standard deduction is used", () => {
    const { container } = render(
      <ItemizedDeductionDetails
        deductionBreakdown={createBreakdown({ deductionUsed: "standard" })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows capped SALT for a federal breakdown", () => {
    render(<ItemizedDeductionDetails deductionBreakdown={createBreakdown()} />);

    expect(screen.getByText("SALT (capped)")).toBeInTheDocument();
    expect(screen.queryByText("Property Tax")).not.toBeInTheDocument();
  });

  it("shows property tax and the high-income limitation for a state breakdown", () => {
    render(
      <ItemizedDeductionDetails
        deductionBreakdown={createBreakdown({
          saltDeduction: 0,
          saltCapped: false,
          propertyTax: 15000,
          highIncomeReduction: 5000,
        })}
      />,
    );

    expect(screen.getByText("Property Tax")).toBeInTheDocument();
    expect(screen.getByText("$15,000")).toBeInTheDocument();
    expect(
      screen.getByText("Less: High-Income Limitation"),
    ).toBeInTheDocument();
    expect(screen.getByText("-$5,000")).toBeInTheDocument();
    expect(screen.queryByText(/SALT/)).not.toBeInTheDocument();
  });
});
