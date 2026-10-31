import { calculateTaxes } from "../calculate";
import { TAX_YEAR, TaxYear } from "../config";
import { loadFederalData, loadStateDataSync } from "../taxData";
import { TaxCalculationResult, TaxInputs, TaxState } from "../types";
import { createDefaultInputs } from "./testData";

/**
 * Run the real federal and state calculators for a set of inputs, so tests
 * work from the results the app actually produces. Withholding is taken as
 * entered, not estimated.
 */
export function calculateResults(
  selectedState: TaxState,
  overrides: Partial<TaxInputs> = {},
  year: TaxYear = TAX_YEAR,
): { federal: TaxCalculationResult; state: TaxCalculationResult } {
  const inputs = createDefaultInputs({
    selectedState,
    taxYear: year,
    ...overrides,
  });
  return calculateTaxes(
    inputs,
    loadFederalData(year),
    loadStateDataSync(selectedState, year),
  );
}
