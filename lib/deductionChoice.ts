import { DeductionChoice, TaxCalculationResult } from "./types";

interface FederalAndStateResults {
  federal: TaxCalculationResult;
  state: TaxCalculationResult;
}

/**
 * Federal and state tax where the state must take the same type of deduction
 * as the federal return (DC). A filer may take the smaller federal deduction,
 * so both types are worked out and the one with the lower combined tax wins.
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
