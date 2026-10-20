import { render, screen } from "@testing-library/react";
import { ComponentType } from "react";
import { TAX_YEAR, TaxYear } from "@/lib/config";
import { calculateFederalTax } from "@/lib/federalTaxCalculator";
import { calculateCaliforniaTax } from "@/lib/states/californiaTaxCalculator";
import { calculateColoradoTax } from "@/lib/states/coloradoTaxCalculator";
import { calculateDCTax } from "@/lib/states/dcTaxCalculator";
import { calculateFloridaTax } from "@/lib/states/floridaTaxCalculator";
import { calculateIllinoisTax } from "@/lib/states/illinoisTaxCalculator";
import { calculateNewYorkTax } from "@/lib/states/newYorkTaxCalculator";
import { calculateWashingtonTax } from "@/lib/states/washingtonTaxCalculator";
import { TaxCalculationResult, TaxInputs, TaxState } from "@/lib/types";
import {
  createDefaultInputs,
  loadTestDataForYear,
} from "@/lib/__tests__/testData";

/**
 * Run the real federal and state calculators for a set of inputs, so
 * breakdown components are tested against the results they actually receive.
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
  const federal = calculateFederalTax(
    inputs,
    data.federalBrackets,
    data.ltcgBrackets,
    data.federalDeductions,
    data.sharedLimits,
    data.federalLimits,
    data.ficaData,
  );

  const calculateState = (): TaxCalculationResult => {
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

  return { federal, state: calculateState() };
}

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
