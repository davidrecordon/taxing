import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import FloridaBreakdown from "../FloridaBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

describe("FloridaBreakdown", () => {
  it("shows that there is no state income tax", () => {
    renderStateBreakdown(FloridaBreakdown, "florida", {
      federalIncome: 200000,
    });

    expect(
      screen.getByText(/Florida has no state income tax/),
    ).toBeInTheDocument();
    expect(rowText("Florida Income Tax")).toContain("$0");
  });

  it("shows a refund when Florida tax was withheld", () => {
    renderStateBreakdown(FloridaBreakdown, "florida", {
      federalIncome: 200000,
      stateTaxWithheld: 1500,
    });

    expect(rowText("Estimated Refund")).toContain("$1,500");
  });
});
