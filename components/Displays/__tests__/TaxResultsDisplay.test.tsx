import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TaxResultsDisplay from "../TaxResultsDisplay";
import { TAX_YEAR } from "@/lib/config";
import { TaxState } from "@/lib/types";
import { calculateResults } from "@/lib/__tests__/calculateResults";

describe("TaxResultsDisplay", () => {
  // What each breakdown shows is tested with the breakdown itself
  it.each<[TaxState, string]>([
    ["california", "California Tax Breakdown"],
    ["colorado", "Colorado Tax Breakdown"],
    ["dc", "District of Columbia Tax Breakdown"],
    ["florida", "Florida Tax Breakdown"],
    ["illinois", "Illinois Tax Breakdown"],
    ["newyork", "New York Tax Breakdown"],
    ["washington", "Washington Tax Breakdown"],
  ])(
    "shows the Federal breakdown and the one for %s",
    async (selectedState, heading) => {
      const results = calculateResults(selectedState, {
        federalIncome: 100000,
      });
      render(
        <TaxResultsDisplay
          results={{ ...results, selectedState }}
          taxYear={TAX_YEAR}
        />,
      );

      expect(screen.getByText("Federal Tax Breakdown")).toBeInTheDocument();
      // State breakdowns are loaded on demand
      expect(await screen.findByText(heading)).toBeInTheDocument();
    },
  );
});
