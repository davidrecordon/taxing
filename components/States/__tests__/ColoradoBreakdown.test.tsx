import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import ColoradoBreakdown from "../ColoradoBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

describe("ColoradoBreakdown", () => {
  it("shows federal taxable income with no adjustments for a typical filer", () => {
    renderStateBreakdown(ColoradoBreakdown, "colorado", {
      federalIncome: 100000,
    });

    // $100,000 less the $16,100 federal standard deduction
    expect(rowText("Federal Taxable Income")).toContain("$83,900");
    expect(rowText("Colorado Taxable Income")).toContain("$83,900");
    expect(
      screen.queryByText("Add: Federal Deduction Addback"),
    ).not.toBeInTheDocument();
  });

  it("shows the deduction addback for high incomes", () => {
    // MFJ, AGI $400,000: $32,200 standard deduction less the $2,000 limit
    renderStateBreakdown(ColoradoBreakdown, "colorado", {
      federalIncome: 400000,
      filingStatus: "marriedFilingJointly",
    });

    expect(rowText("Federal Taxable Income")).toContain("$367,800");
    expect(rowText("Add: Federal Deduction Addback")).toContain("$30,200");
    expect(rowText("Colorado Taxable Income")).toContain("$398,000");
  });

  it("shows the charitable subtraction for non-itemizers", () => {
    renderStateBreakdown(ColoradoBreakdown, "colorado", {
      federalIncome: 120000,
      charitableContributions: 3000,
      filingStatus: "marriedFilingJointly",
    });

    expect(rowText("Less: Charitable Contribution Subtraction")).toContain(
      "-$2,500",
    );
    // $120,000 - $32,200 standard deduction - $2,500
    expect(rowText("Colorado Taxable Income")).toContain("$85,300");
  });
});
