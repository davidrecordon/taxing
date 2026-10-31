import {
  CharitableScenario,
  summarizeCharitableScenario,
} from "./charitableScenario";
import {
  STATES_SHARING_DEDUCTION_CHOICE,
  calculateWithSharedDeductionChoice,
} from "./deductionChoice";
import { calculateFederalTax } from "./federalTaxCalculator";
import { SplitConfig, buildSpouseInputs } from "./spouseInputs";
import { StateData } from "./stateData";
import { calculateCaliforniaTax } from "./states/californiaTaxCalculator";
import { calculateColoradoTax } from "./states/coloradoTaxCalculator";
import { calculateDCTax } from "./states/dcTaxCalculator";
import { calculateFloridaTax } from "./states/floridaTaxCalculator";
import { calculateIllinoisTax } from "./states/illinoisTaxCalculator";
import { calculateNewYorkTax } from "./states/newYorkTaxCalculator";
import { calculateWashingtonTax } from "./states/washingtonTaxCalculator";
import {
  CalculationResults,
  DeductionChoice,
  DeductionsData,
  FederalLimitsData,
  FicaData,
  SharedLimitsData,
  TaxBracketsData,
  TaxCalculationResult,
  TaxInputs,
} from "./types";
import {
  WithholdingEstimate,
  applyWithholdingEstimate,
  estimateWithholding,
} from "./withholdingEstimate";

/**
 * Runs the federal and state calculators together the way the app does. The
 * page, the tests and the MCP server all go through this module, so there is
 * one place that knows how the pieces fit.
 */

// The federal data every calculation needs, for one tax year
export interface FederalData {
  federalBrackets: TaxBracketsData;
  federalDeductions: DeductionsData;
  federalLimits: FederalLimitsData;
  ficaData: FicaData;
  ltcgBrackets: TaxBracketsData;
  sharedLimits: SharedLimitsData;
}

export interface FederalAndState {
  federal: TaxCalculationResult;
  state: TaxCalculationResult;
}

function calculateState(
  inputs: TaxInputs,
  federalData: FederalData,
  stateData: StateData,
  federal: TaxCalculationResult,
): TaxCalculationResult {
  const { ficaData, federalLimits, sharedLimits } = federalData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brackets = stateData.brackets as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deductions = stateData.deductions as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limits = stateData.limits as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nycBrackets = stateData.nycBrackets as any;

  switch (inputs.selectedState) {
    case "california":
      return calculateCaliforniaTax(
        inputs,
        brackets,
        deductions,
        sharedLimits,
        limits,
        ficaData,
      );
    case "colorado":
      return calculateColoradoTax(
        inputs,
        brackets,
        sharedLimits,
        limits,
        federal,
        ficaData,
      );
    case "dc":
      return calculateDCTax(
        inputs,
        brackets,
        deductions,
        sharedLimits,
        federalLimits,
        limits,
        ficaData,
        federal.deductionBreakdown,
      );
    case "florida":
      return calculateFloridaTax(inputs);
    case "illinois":
      return calculateIllinoisTax(
        inputs,
        brackets,
        deductions,
        sharedLimits,
        limits,
        ficaData,
        federal.adjustedGrossIncome,
      );
    case "newyork":
      return calculateNewYorkTax(
        inputs,
        brackets,
        nycBrackets,
        deductions,
        sharedLimits,
        limits,
        ficaData,
      );
    case "washington":
      return calculateWashingtonTax(inputs, brackets, limits);
  }
}

/**
 * Federal and state tax for a set of inputs, taken as entered. In DC and
 * Colorado the type of federal deduction changes the state tax, so the pair
 * is chosen together for the lower combined tax.
 */
export function calculateTaxes(
  inputs: TaxInputs,
  federalData: FederalData,
  stateData: StateData,
): FederalAndState {
  const calculateFederal = (deductionChoice?: DeductionChoice) =>
    calculateFederalTax(
      inputs,
      federalData.federalBrackets,
      federalData.ltcgBrackets,
      federalData.federalDeductions,
      federalData.sharedLimits,
      federalData.federalLimits,
      federalData.ficaData,
      deductionChoice,
    );
  const withState = (federal: TaxCalculationResult) =>
    calculateState(inputs, federalData, stateData, federal);

  if (STATES_SHARING_DEDUCTION_CHOICE.includes(inputs.selectedState)) {
    return calculateWithSharedDeductionChoice(calculateFederal, withState);
  }

  const federal = calculateFederal();
  return { federal, state: withState(federal) };
}

export interface Estimate {
  results: CalculationResults;
  // What the wages would have had withheld, shown while a field is blank
  withholdingEstimate: WithholdingEstimate;
  // The inputs the calculators ran on: entered withholding, or the estimate
  resolvedInputs: TaxInputs;
}

/**
 * The estimate the app shows: withholding the user has not entered is
 * estimated from the wage inputs, and the results say when that happened.
 */
export function calculateEstimate(
  inputs: TaxInputs,
  federalData: FederalData,
  stateData: StateData,
): Estimate {
  const withholdingEstimate = estimateWithholding(
    inputs,
    federalData,
    stateData,
  );
  const resolved = applyWithholdingEstimate(inputs, withholdingEstimate);
  const { federal, state } = calculateTaxes(
    resolved.inputs,
    federalData,
    stateData,
  );
  return {
    results: {
      federal: { ...federal, withheldEstimated: resolved.federalEstimated },
      state: { ...state, withheldEstimated: resolved.stateEstimated },
      selectedState: resolved.inputs.selectedState,
    },
    withholdingEstimate,
    resolvedInputs: resolved.inputs,
  };
}

/**
 * Federal and state tax for a different amount of charitable giving, with
 * what limited the deduction. `inputs` should already have withholding
 * resolved, so the comparison is between gifts, not between estimates.
 */
export function calculateCharitableScenario(
  inputs: TaxInputs,
  contributions: number,
  federalData: FederalData,
  stateData: StateData,
): CharitableScenario {
  const { federal, state } = calculateTaxes(
    { ...inputs, charitableContributions: contributions },
    federalData,
    stateData,
  );
  return summarizeCharitableScenario(
    federal,
    state,
    federalData.federalLimits,
  );
}

export interface ScenarioResult {
  federalTax: number;
  stateTax: number;
  totalTax: number;
}

export interface MFSScenarioResult {
  spouse1: ScenarioResult;
  spouse2: ScenarioResult;
  combined: ScenarioResult;
}

function scenarioResult(
  inputs: TaxInputs,
  federalData: FederalData,
  stateData: StateData,
): ScenarioResult {
  const { federal, state } = calculateTaxes(inputs, federalData, stateData);
  return {
    federalTax: federal.totalTax,
    stateTax: state.totalTax,
    totalTax: federal.totalTax + state.totalTax,
  };
}

// The couple's tax on one joint return
export function calculateJointScenario(
  inputs: TaxInputs,
  federalData: FederalData,
  stateData: StateData,
): ScenarioResult {
  return scenarioResult(
    { ...inputs, filingStatus: "marriedFilingJointly" },
    federalData,
    stateData,
  );
}

// The couple's tax on two separate returns, dividing the joint figures by
// the splits (each one spouse 1's percentage)
export function calculateMFSScenario(
  inputs: TaxInputs,
  splits: SplitConfig,
  federalData: FederalData,
  stateData: StateData,
): MFSScenarioResult {
  const spouse1 = scenarioResult(
    buildSpouseInputs(inputs, splits, true),
    federalData,
    stateData,
  );
  const spouse2 = scenarioResult(
    buildSpouseInputs(inputs, splits, false),
    federalData,
    stateData,
  );
  return {
    spouse1,
    spouse2,
    combined: {
      federalTax: spouse1.federalTax + spouse2.federalTax,
      stateTax: spouse1.stateTax + spouse2.stateTax,
      totalTax: spouse1.totalTax + spouse2.totalTax,
    },
  };
}
