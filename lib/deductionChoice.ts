import { DeductionChoice, TaxCalculationResult, TaxState } from "./types";

// States whose tax depends on the type of federal deduction taken: DC must
// take the same type, and Colorado's charitable subtraction is only for
// filers who take the federal standard deduction
export const STATES_SHARING_DEDUCTION_CHOICE: TaxState[] = ["colorado", "dc"];

interface FederalAndStateResults {
  federal: TaxCalculationResult;
  state: TaxCalculationResult;
}

/**
 * Federal and state tax where the type of federal deduction changes the state
 * tax. A filer may take the smaller federal deduction, so both types are
 * worked out and the one with the lower combined tax wins.
 * The larger federal deduction is kept when the two come out the same.
 */
export function calculateWithSharedDeductionChoice(
  calculateFederal: (deductionChoice?: DeductionChoice) => TaxCalculationResult,
  calculateState: (federal: TaxCalculationResult) => TaxCalculationResult,
): FederalAndStateResults {
  const federal = calculateFederal();
  const state = calculateState(federal);

  const otherFederal = calculateFederal(
    federal.deductionBreakdown.deductionUsed === "itemized"
      ? "standard"
      : "itemized",
  );
  const otherState = calculateState(otherFederal);

  if (
    otherFederal.totalTax + otherState.totalTax >=
    federal.totalTax + state.totalTax
  ) {
    return { federal, state };
  }

  return {
    federal: {
      ...otherFederal,
      deductionBreakdown: {
        ...otherFederal.deductionBreakdown,
        chosenForStateTax: true,
      },
    },
    state: otherState,
  };
}
