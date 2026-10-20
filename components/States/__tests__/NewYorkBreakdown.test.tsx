import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import NewYorkBreakdown from "../NewYorkBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

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

  it("hides the NYC section for other New York residents", () => {
    renderStateBreakdown(NewYorkBreakdown, "newyork", {
      federalIncome: 100000,
    });

    expect(
      screen.queryByText("NYC Local Tax by Bracket"),
    ).not.toBeInTheDocument();
  });
});
