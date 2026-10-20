import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import IllinoisBreakdown from "../IllinoisBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

describe("IllinoisBreakdown", () => {
  it("shows the personal exemption and taxable income", () => {
    renderStateBreakdown(IllinoisBreakdown, "illinois", {
      federalIncome: 100000,
    });

    expect(rowText("Less: Personal Exemption")).toContain("-$2,925");
    expect(rowText("Illinois Taxable Income")).toContain("$97,075");
    expect(screen.queryByText(/Property Tax Credit/)).not.toBeInTheDocument();
  });

  it("shows the property tax credit", () => {
    const result = renderStateBreakdown(IllinoisBreakdown, "illinois", {
      federalIncome: 150000,
      propertyTaxesPaid: 8000,
      filingStatus: "marriedFilingJointly",
    });

    expect(rowText(/Less: Property Tax Credit/)).toContain("-$400");
    expect(rowText("Total Illinois Tax")).toContain("$6,735");
    expect(result.totalTax).toBeCloseTo(6735.43, 1);
  });

  it("explains the lost exemption and credit above the income limit", () => {
    renderStateBreakdown(IllinoisBreakdown, "illinois", {
      federalIncome: 300000,
      propertyTaxesPaid: 8000,
    });

    expect(
      screen.getByText(/No personal exemption or property tax credit/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Less: Personal Exemption"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Less: Property Tax Credit/),
    ).not.toBeInTheDocument();
    expect(rowText("Illinois Taxable Income")).toContain("$300,000");
  });
});
