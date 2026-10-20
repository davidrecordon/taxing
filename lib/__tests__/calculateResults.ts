import { TAX_YEAR, TaxYear } from "../config";
import { calculateWithSharedDeductionChoice } from "../deductionChoice";
import { calculateFederalTax } from "../federalTaxCalculator";
import { calculateCaliforniaTax } from "../states/californiaTaxCalculator";
import { calculateColoradoTax } from "../states/coloradoTaxCalculator";
import { calculateDCTax } from "../states/dcTaxCalculator";
import { calculateFloridaTax } from "../states/floridaTaxCalculator";
import { calculateIllinoisTax } from "../states/illinoisTaxCalculator";
import { calculateNewYorkTax } from "../states/newYorkTaxCalculator";
import { calculateWashingtonTax } from "../states/washingtonTaxCalculator";
import {
  DeductionChoice,
  TaxCalculationResult,
  TaxInputs,
  TaxState,
} from "../types";
import { createDefaultInputs, loadTestDataForYear } from "./testData";

/**
 * Run the real federal and state calculators for a set of inputs, so
 * tests work from the results the app actually produces.
 */
export function calculateResults(
  selectedState: TaxState,
  overrides: Partial<TaxInputs> = {},
  year: TaxYear = TAX_YEAR,
): { federal: TaxCalculationResult; state: TaxCalculationResult } {
  const data = loadTestDataForYear(year);
  const inputs = createDefaultInputs({
    selectedState,
    taxYear: year,
    ...overrides,
  });
  const calculateFederal = (deductionChoice?: DeductionChoice) =>
    calculateFederalTax(
      inputs,
      data.federalBrackets,
      data.ltcgBrackets,
      data.federalDeductions,
      data.sharedLimits,
      data.federalLimits,
      data.ficaData,
      deductionChoice,
    );

  const calculateState = (
    federal: TaxCalculationResult,
  ): TaxCalculationResult => {
    switch (selectedState) {
      case "california":
        return calculateCaliforniaTax(
          inputs,
          data.californiaBrackets,
          data.californiaDeductions,
          data.sharedLimits,
          data.californiaLimits,
          data.ficaData,
        );
      case "colorado":
        return calculateColoradoTax(
          inputs,
          data.coloradoBrackets,
          data.sharedLimits,
          data.coloradoLimits,
          federal,
          data.ficaData,
        );
      case "dc":
        return calculateDCTax(
          inputs,
          data.dcBrackets,
          data.dcDeductions,
          data.sharedLimits,
          data.federalLimits,
          data.dcLimits,
          data.ficaData,
          federal.deductionBreakdown,
        );
      case "florida":
        return calculateFloridaTax(inputs);
      case "illinois":
        return calculateIllinoisTax(
          inputs,
          data.illinoisBrackets,
          data.illinoisDeductions,
          data.sharedLimits,
          data.illinoisLimits,
          data.ficaData,
        );
      case "newyork":
        return calculateNewYorkTax(
          inputs,
          data.newYorkBrackets,
          data.nycBrackets,
          data.newYorkDeductions,
          data.sharedLimits,
          data.newYorkLimits,
          data.ficaData,
        );
      case "washington":
        return calculateWashingtonTax(
          inputs,
          data.washingtonBrackets,
          data.washingtonLimits,
        );
    }
  };

  // DC takes the same type of deduction as the federal return, as in the app
  if (selectedState === "dc") {
    return calculateWithSharedDeductionChoice(calculateFederal, calculateState);
  }

  const federal = calculateFederal();
  return { federal, state: calculateState(federal) };
}
