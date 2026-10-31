import { TaxInputs } from "./types";

/**
 * The people behind the wages on a return. Payroll tax and employer
 * withholding work per employee: Social Security is capped per person,
 * Additional Medicare is withheld above $200,000 of one employee's wages
 * whatever the filing status, and each employer runs the withholding tables
 * on its own employee's wages. On a joint return the spouse's wages, when
 * given, divide the couple's wages into two earners for those purposes.
 * Income tax is always on the combined figure.
 */

// The spouse's wages are a portion of wages, so they cannot exceed them
export function spouseWages(inputs: TaxInputs): number {
  if (inputs.filingStatus !== "marriedFilingJointly") {
    return 0;
  }
  return Math.max(0, Math.min(inputs.spouseWages, inputs.federalIncome));
}

// Each earner's wages: everything for one earner, or the two parts. Worked
// out by subtraction so that the parts add back to the wages exactly.
export function earnerWages(inputs: TaxInputs): number[] {
  const spouse = spouseWages(inputs);
  if (spouse <= 0) {
    return [inputs.federalIncome];
  }
  return [inputs.federalIncome - spouse, spouse];
}

// Each earner's share of the wages, for dividing what is paid with them
export function earnerShares(inputs: TaxInputs): number[] {
  return earnerWages(inputs).map((wages) =>
    inputs.federalIncome > 0 ? wages / inputs.federalIncome : 1,
  );
}

// The inputs as one earner's employer sees them: that earner's share of the
// wages, with bonuses and stock, state wages and the pre-tax payroll
// deductions divided in the same proportion
export function earnerInputs(inputs: TaxInputs): TaxInputs[] {
  return earnerShares(inputs).map((share) => ({
    ...inputs,
    federalIncome: inputs.federalIncome * share,
    stateIncome: inputs.stateIncome * share,
    supplementalWages: inputs.supplementalWages * share,
    contributions401k: inputs.contributions401k * share,
    preTaxMedical: inputs.preTaxMedical * share,
    spouseWages: 0,
  }));
}
