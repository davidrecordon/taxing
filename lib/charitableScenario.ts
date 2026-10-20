import { calculateCharitableFloor } from "./deductionCalculator";
import { FederalLimitsData, TaxCalculationResult } from "./types";

/**
 * Federal and state tax for one amount of charitable giving, with the pieces
 * needed to explain what limits the deduction.
 */
export interface CharitableScenario {
  federalTax: number;
  stateTax: number;
  // Giving that is not deductible federally this year (0 when not itemizing)
  federalFloor: number;
  federalItemizes: boolean;
  // The Federal return takes the standard deduction, although itemizing is
  // larger, because that lowers Federal and state tax combined
  standardChosenForStateTax: boolean;
  federalHighIncomeReduction: number;
  stateHighIncomeReduction: number;
}

/**
 * What a gift saves compared with giving nothing. Amounts are whole dollars so
 * the parts always add up to the total; a negative amount means the gift
 * raises that tax.
 */
export interface CharitableSaving {
  federalSaved: number;
  stateSaved: number;
  totalSaved: number;
  // The gift itself increased an income-based reduction, so part of it was
  // not deducted (as opposed to a reduction that would apply anyway)
  federalLimitGrew: boolean;
  stateLimitGrew: boolean;
}

export function summarizeCharitableScenario(
  federal: TaxCalculationResult,
  state: TaxCalculationResult,
  federalLimits: FederalLimitsData,
): CharitableScenario {
  const federalItemizes =
    federal.deductionBreakdown.deductionUsed === "itemized";

  return {
    federalTax: federal.totalTax,
    stateTax: state.totalTax,
    federalFloor: federalItemizes
      ? calculateCharitableFloor(federal.adjustedGrossIncome, federalLimits)
      : 0,
    federalItemizes,
    standardChosenForStateTax:
      !federalItemizes &&
      federal.deductionBreakdown.chosenForStateTax === true,
    federalHighIncomeReduction:
      federal.deductionBreakdown.highIncomeReduction ?? 0,
    stateHighIncomeReduction: state.deductionBreakdown.highIncomeReduction ?? 0,
  };
}

export function compareWithNoGiving(
  noGiving: CharitableScenario,
  scenario: CharitableScenario,
): CharitableSaving {
  const federalSaved = Math.round(noGiving.federalTax - scenario.federalTax);
  const stateSaved = Math.round(noGiving.stateTax - scenario.stateTax);

  return {
    federalSaved,
    stateSaved,
    totalSaved: federalSaved + stateSaved,
    federalLimitGrew:
      Math.round(
        scenario.federalHighIncomeReduction -
          noGiving.federalHighIncomeReduction,
      ) > 0,
    stateLimitGrew:
      Math.round(
        scenario.stateHighIncomeReduction - noGiving.stateHighIncomeReduction,
      ) > 0,
  };
}
