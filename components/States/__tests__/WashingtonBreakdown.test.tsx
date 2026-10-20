import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import WashingtonBreakdown from "../WashingtonBreakdown";
import { renderStateBreakdown, rowText } from "./calculateResults";

describe("WashingtonBreakdown", () => {
  it("shows no tax due without long-term gains", () => {
    renderStateBreakdown(WashingtonBreakdown, "washington", {
      federalIncome: 200000,
    });

    expect(screen.getByText(/No Washington tax due/)).toBeInTheDocument();
  });

  it("shows the gains flow and tax for large long-term gains", () => {
    // $1,500,000 of gains: $1,000,000 taxable at 7% + $222,000 at 9.9%
    renderStateBreakdown(WashingtonBreakdown, "washington", {
      longTermCapitalGains: 1500000,
    });

    expect(rowText("Net Long-Term Capital Gains")).toContain("$1,500,000");
    expect(rowText("Total Washington Tax")).toContain("$91,978");
  });

  it("shows the loss carryover applied to gains", () => {
    renderStateBreakdown(WashingtonBreakdown, "washington", {
      longTermCapitalGains: 500000,
      priorYearLongTermLossCarryover: 100000,
    });

    expect(rowText("Less: Loss Carryover")).toContain("-$100,000");
    expect(rowText("Net Long-Term Capital Gains")).toContain("$400,000");
  });
});
