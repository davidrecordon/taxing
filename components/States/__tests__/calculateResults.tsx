import { render, screen } from "@testing-library/react";
import { ComponentType } from "react";
import { TAX_YEAR, TaxYear } from "@/lib/config";
import { TaxCalculationResult, TaxInputs, TaxState } from "@/lib/types";
import { calculateResults } from "@/lib/__tests__/calculateResults";

export { calculateResults };

/** Render a state breakdown with calculated results for the inputs. */
export function renderStateBreakdown(
  Breakdown: ComponentType<{ result: TaxCalculationResult; taxYear: TaxYear }>,
  selectedState: TaxState,
  overrides: Partial<TaxInputs> = {},
  year: TaxYear = TAX_YEAR,
): TaxCalculationResult {
  const { state } = calculateResults(selectedState, overrides, year);
  render(<Breakdown result={state} taxYear={year} />);
  return state;
}

/** The text of the row (label and amount) that contains the given label. */
export function rowText(label: string | RegExp): string {
  return screen.getByText(label).parentElement?.textContent ?? "";
}
