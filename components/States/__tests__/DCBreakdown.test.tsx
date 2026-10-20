import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import DCBreakdown from "../DCBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

describe("DCBreakdown", () => {
  it("shows AGI and taxable income with the standard deduction", () => {
    const result = renderStateBreakdown(DCBreakdown, "dc", {
      federalIncome: 100000,
    });

    expect(rowText("DC Adjusted Gross Income (AGI)")).toContain("$100,000");
    expect(result.deductionBreakdown.deductionUsed).toBe("standard");
    expect(
      screen.queryByText("Itemized Deduction Breakdown:"),
    ).not.toBeInTheDocument();
  });

  it("explains that itemizing follows the federal return", () => {
    // The federal return itemizes ($21,250), so DC must itemize too even
    // though its $11,250 is below the DC standard deduction
    renderStateBreakdown(DCBreakdown, "dc", {
      federalIncome: 150000,
      stateTaxWithheld: 9500,
      propertyTaxesPaid: 6000,
      mortgageInterestPaid: 5000,
      charitableContributions: 1000,
    });

    expect(rowText("Property Tax")).toContain("$6,000");
    expect(
      screen.getByText(
        "(Itemizing is required here because the Federal return itemizes.)",
      ),
    ).toBeInTheDocument();
    expect(rowText("DC Taxable Income")).toContain("$138,750");
  });

  it("shows the 5% high-income limitation", () => {
    // $37,000 of deductions less 5% x ($300,000 - $200,000); the federal
    // charitable floor removes $1,500 of the $5,000 of giving first
    renderStateBreakdown(DCBreakdown, "dc", {
      federalIncome: 300000,
      stateTaxWithheld: 22000,
      propertyTaxesPaid: 12000,
      mortgageInterestPaid: 20000,
      charitableContributions: 5000,
    });

    expect(rowText("Less: High-Income Limitation")).toContain("-$5,000");
    expect(rowText("DC Taxable Income")).toContain("$269,500");
  });
});
