import { describe, it, expect } from "vitest";
import { TAX_YEAR } from "@/lib/config";
import { render, screen } from "@testing-library/react";
import NewYorkBreakdown from "../NewYorkBreakdown";
import {
  calculateResults,
  renderStateBreakdown,
  rowText,
} from "./calculateResults";

describe("NewYorkBreakdown", () => {
  it("shows AGI before the deduction and taxable income after it", () => {
    renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 100000,
    });

    expect(rowText("New York Adjusted Gross Income (AGI)")).toContain(
      "$100,000",
    );
    // $100,000 less the $8,000 standard deduction
    expect(rowText("New York Taxable Income")).toContain("$92,000");
  });

  it("shows property tax and the income-based reduction when itemizing", () => {
    // $20,000 of property tax less the 25% adjustment at $200,000 of AGI
    renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 200000,
      propertyTaxesPaid: 20000,
      stateTaxWithheld: 10000,
    });

    expect(rowText("Property Tax")).toContain("$20,000");
    expect(rowText("Less: High-Income Limitation")).toContain("-$5,000");
    expect(rowText("New York Taxable Income")).toContain("$185,000");
  });

  it("shows the NYC section only for city residents", () => {
    renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 100000,
      isNYCResident: true,
    });

    expect(screen.getByText("NYC Local Tax by Bracket")).toBeInTheDocument();
    expect(screen.getByText("Combined NY + NYC Tax")).toBeInTheDocument();
  });

  it("shows the tax benefit recapture for higher incomes", () => {
    // Single, $130,000 in 2026: $6,629.75 bracket tax + $254.01 recapture
    const result = renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 130000,
    });

    expect(rowText("Tax Benefit Recapture")).toContain("$254");
    expect(rowText("NY State Tax with Recapture")).toContain("$6,884");
    expect(result.totalTax).toBeCloseTo(6883.76, 1);
  });

  it("shows the NYC school tax credit for city residents", () => {
    renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 100000,
      isNYCResident: true,
    });

    expect(rowText("Less: NYC School Tax Credit")).toContain("-$266");
    expect(screen.queryByText("Tax Benefit Recapture")).not.toBeInTheDocument();
  });

  it("hides the NYC section for other New York residents", () => {
    renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 100000,
    });

    expect(
      screen.queryByText("NYC Local Tax by Bracket"),
    ).not.toBeInTheDocument();
  });
  it("says when the withheld amount was estimated from wages", () => {
    const { state } = calculateResults("newyork", {
      federalIncome: 100000,
      stateTaxWithheld: 3000,
    });

    render(
      <NewYorkBreakdown result={{ ...state, withheldEstimated: true }} taxYear={TAX_YEAR} />,
    );

    expect(screen.getByText("Less: Withheld (estimated)")).toBeInTheDocument();
  });
});
