import { calculateTaxByBrackets } from "./taxUtils";
import { StateData } from "./stateData";
import {
  CaliforniaLimitsData,
  DeductionsData,
  FederalLimitsData,
  TaxBracketsData,
  TaxInputs,
} from "./types";

/**
 * What an employer would withhold over the year, worked out from the wage
 * inputs. Used in place of a withholding amount the user has not entered, so
 * the amount owed and the safe harbor read sensibly before a paystub is at
 * hand.
 *
 * Regular wages: the annual bracket schedule applied to wages after pre-tax
 * deductions and the standard deduction. This is the shape of the federal
 * percentage method for a W-4 with no adjustments, and an approximation of
 * California's withholding schedules.
 *
 * Bonuses and stock: the flat supplemental rates. Federal withholds 22% on
 * the first $1,000,000 of supplemental wages in the year and 37% above that.
 * California withholds 10.23% on bonuses and stock.
 */
export interface WithholdingEstimate {
  federal: number;
  federalRegular: number;
  federalSupplemental: number;
  // null where the state's withholding is not modelled
  state: number | null;
  stateRegular: number;
  stateSupplemental: number;
}

export interface FederalWithholdingData {
  federalBrackets: TaxBracketsData;
  federalDeductions: DeductionsData;
  federalLimits: FederalLimitsData;
}

// Withholding on one set of wages, split by how it is worked out
interface WithholdingParts {
  regular: number;
  supplemental: number;
}

// The part of wages paid as bonuses or stock. The field is a portion of wages,
// so it cannot exceed them.
function supplementalWages(inputs: TaxInputs): number {
  return Math.max(0, Math.min(inputs.supplementalWages, inputs.federalIncome));
}

// The annual schedule applied to regular wages: wages less the supplemental
// part and the pre-tax payroll deductions, then less the standard deduction
function withholdingOnRegularWages(
  wages: number,
  supplemental: number,
  brackets: TaxBracketsData,
  deductions: DeductionsData,
  inputs: TaxInputs,
): number {
  const regular = Math.max(
    0,
    wages - supplemental - inputs.contributions401k - inputs.preTaxMedical,
  );
  return calculateTaxByBrackets(
    Math.max(0, regular - deductions.standardDeduction[inputs.filingStatus]),
    brackets.brackets[inputs.filingStatus],
  ).total;
}

function estimateFederalWithholding(
  inputs: TaxInputs,
  data: FederalWithholdingData,
): WithholdingParts {
  const supplemental = supplementalWages(inputs);
  const { highRate, highThreshold, rate } =
    data.federalLimits.supplementalWithholding;
  return {
    regular: withholdingOnRegularWages(
      inputs.federalIncome,
      supplemental,
      data.federalBrackets,
      data.federalDeductions,
      inputs,
    ),
    supplemental:
      Math.min(supplemental, highThreshold) * rate +
      Math.max(0, supplemental - highThreshold) * highRate,
  };
}

// California is the one state with a modelled withholding estimate. Other
// states return null and the user enters the amount.
function estimateStateWithholding(
  inputs: TaxInputs,
  stateData: StateData | undefined,
): WithholdingParts | null {
  if (inputs.selectedState !== "california" || !stateData) return null;
  const limits = stateData.limits as CaliforniaLimitsData;

  const wages = inputs.stateIncome || inputs.federalIncome;
  const supplemental = Math.min(supplementalWages(inputs), wages);
  return {
    regular: withholdingOnRegularWages(
      wages,
      supplemental,
      stateData.brackets as TaxBracketsData,
      stateData.deductions as DeductionsData,
      inputs,
    ),
    supplemental: supplemental * limits.supplementalWithholdingRate,
  };
}

export function estimateWithholding(
  inputs: TaxInputs,
  federalData: FederalWithholdingData,
  stateData: StateData | undefined,
): WithholdingEstimate {
  const federal = estimateFederalWithholding(inputs, federalData);
  const state = estimateStateWithholding(inputs, stateData);
  return {
    federal: federal.regular + federal.supplemental,
    federalRegular: federal.regular,
    federalSupplemental: federal.supplemental,
    state: state ? state.regular + state.supplemental : null,
    stateRegular: state?.regular ?? 0,
    stateSupplemental: state?.supplemental ?? 0,
  };
}

export interface ResolvedWithholding {
  inputs: TaxInputs;
  federalEstimated: boolean;
  stateEstimated: boolean;
}

// The inputs the calculators run on: the estimate stands in for a withholding
// amount the user has left blank, and an entered amount always wins
export function applyWithholdingEstimate(
  inputs: TaxInputs,
  estimate: WithholdingEstimate,
): ResolvedWithholding {
  const stateEstimate = estimate.state ?? 0;
  const federalEstimated =
    inputs.federalTaxWithheld === 0 && estimate.federal > 0;
  const stateEstimated = inputs.stateTaxWithheld === 0 && stateEstimate > 0;
  return {
    inputs: {
      ...inputs,
      federalTaxWithheld: federalEstimated
        ? estimate.federal
        : inputs.federalTaxWithheld,
      stateTaxWithheld: stateEstimated
        ? stateEstimate
        : inputs.stateTaxWithheld,
    },
    federalEstimated,
    stateEstimated,
  };
}
