import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import CaliforniaBreakdown from "../CaliforniaBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

describe("CaliforniaBreakdown", () => {
  it("shows AGI before the deduction and taxable income after it", () => {
    renderStateBreakdown(CaliforniaBreakdown, "california", {
      federalIncome: 100000,
    });

    expect(rowText("California Adjusted Gross Income (AGI)")).toContain(
      "$100,000",
    );
    // $100,000 less the $5,900 standard deduction
    expect(rowText("California Taxable Income")).toContain("$94,100");
    expect(
      screen.queryByText("Itemized Deduction Breakdown:"),
    ).not.toBeInTheDocument();
  });

  it("shows interest and dividends in the income section", () => {
    renderStateBreakdown(CaliforniaBreakdown, "california", {
      federalIncome: 100000,
      interestIncome: 5000,
      ordinaryDividends: 8000,
    });

    expect(rowText("Interest")).toContain("$5,000");
    expect(rowText("Dividends")).toContain("$8,000");
    expect(rowText("Gross Income")).toContain("$113,000");
  });

  it("shows property tax and the high-income limitation when itemizing", () => {
    // AGI $600,000; $65,000 of deductions less 6% x ($600,000 - $252,203)
    renderStateBreakdown(CaliforniaBreakdown, "california", {
      federalIncome: 620000,
      contributions401k: 20000,
      propertyTaxesPaid: 15000,
      mortgageInterestPaid: 30000,
      mortgageBalance: 900000,
      charitableContributions: 20000,
    });

    expect(
      screen.getByText("Itemized Deduction Breakdown:"),
    ).toBeInTheDocument();
    expect(rowText("Property Tax")).toContain("$15,000");
    expect(rowText("Less: High-Income Limitation")).toContain("-$20,868");
    expect(rowText("California Adjusted Gross Income (AGI)")).toContain(
      "$600,000",
    );
    expect(rowText("California Taxable Income")).toContain("$555,868");
    expect(screen.queryByText(/SALT/)).not.toBeInTheDocument();
  });
});
