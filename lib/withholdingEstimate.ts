import { calculateTaxByBrackets } from "./taxUtils";
import { StateData } from "./stateData";
import {
  CaliforniaWithholdingData,
  ColoradoWithholdingData,
  DeductionsData,
  FederalLimitsData,
  IllinoisWithholdingData,
  TaxBracketsData,
  TaxInputs,
} from "./types";

/**
 * What an employer would withhold over the year, worked out from the wage
 * inputs. Used in place of a withholding amount the user has not entered, so
 * the amount owed and the safe harbor read sensibly before a paystub is at
 * hand.
 *
 * Federal regular wages: the ordinary brackets applied to wages after pre-tax
 * deductions and the standard deduction. That is the percentage method itself
 * for a 2020-or-later W-4 with the Step 2 box unchecked and nothing in Steps 3
 * and 4 (Pub. 15-T's Worksheet 1A adjustment plus the schedule's 0% band add
 * up to the standard deduction, and every edge is offset by the same amount).
 *
 * California regular wages: EDD's Method B exact calculation, which is not
 * the tax table. Its rates are 10% above the tax rates, its bracket edges and
 * standard deduction are the prior year's, a credit is given per allowance,
 * and nothing is withheld below a low-income line.
 *
 * Colorado and Illinois regular wages: the flat rate on wages less the
 * employer worksheet's annual allowance (Colorado's standard allowance by
 * filing status; Illinois's allowance for the employee, and one more for a
 * spouse on a joint return).
 *
 * Bonuses and stock: the flat supplemental rates. Federal withholds 22% on
 * the first $1,000,000 of supplemental wages in the year and 37% above that.
 * California withholds 10.23% on bonuses and stock. Colorado and Illinois
 * have no separate rule, so bonuses and stock are withheld on at the flat
 * rate like any other wages.
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

// The wages a state estimate runs on, and how they split: the part paid as
// bonuses or stock, and the regular wages after the pre-tax payroll deductions
function stateWages(inputs: TaxInputs) {
  const wages = inputs.stateIncome || inputs.federalIncome;
  const supplemental = Math.min(supplementalWages(inputs), wages);
  const regular = Math.max(
    0,
    wages - supplemental - inputs.contributions401k - inputs.preTaxMedical,
  );
  return { regular, supplemental };
}

function estimateCaliforniaWithholding(
  inputs: TaxInputs,
  table: CaliforniaWithholdingData,
): WithholdingParts {
  const { filingStatus } = inputs;
  const { regular, supplemental } = stateWages(inputs);

  // Method B: nothing below the low-income line; otherwise the schedule on
  // wages less the standard deduction, less the allowance credit
  let regularWithholding = 0;
  if (regular > table.lowIncomeExemption[filingStatus]) {
    const tax = calculateTaxByBrackets(
      Math.max(0, regular - table.standardDeduction[filingStatus]),
      table.brackets[filingStatus],
    ).total;
    const credit =
      table.assumedAllowances[filingStatus] * table.allowanceCredit;
    regularWithholding = Math.max(0, tax - credit);
  }
  return {
    regular: regularWithholding,
    supplemental: supplemental * table.supplementalRate,
  };
}

// One rate on all wages less an annual allowance, with no separate rule for
// bonuses and stock. The allowance comes off regular wages first; bonuses and
// stock are withheld on at the same rate once it is used up.
function flatRateWithholding(
  inputs: TaxInputs,
  rate: number,
  allowance: number,
): WithholdingParts {
  const { regular, supplemental } = stateWages(inputs);
  const taxable = Math.max(0, regular + supplemental - allowance);
  const regularTaxable = Math.max(0, regular - allowance);
  return {
    regular: regularTaxable * rate,
    supplemental: (taxable - regularTaxable) * rate,
  };
}

// The states with a modelled withholding estimate. Other states return null
// and the user enters the amount.
function estimateStateWithholding(
  inputs: TaxInputs,
  stateData: StateData | undefined,
): WithholdingParts | null {
  if (!stateData?.withholding) {
    return null;
  }
  const { filingStatus } = inputs;
  switch (inputs.selectedState) {
    case "california":
      return estimateCaliforniaWithholding(
        inputs,
        stateData.withholding as CaliforniaWithholdingData,
      );
    case "colorado": {
      const table = stateData.withholding as ColoradoWithholdingData;
      return flatRateWithholding(
        inputs,
        table.rate,
        table.standardAllowance[filingStatus],
      );
    }
    case "illinois": {
      const table = stateData.withholding as IllinoisWithholdingData;
      return flatRateWithholding(
        inputs,
        table.rate,
        table.assumedAllowances[filingStatus] * table.allowance,
      );
    }
    default:
      return null;
  }
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
