import { spouseWages } from "./earners";
import { TaxInputs } from "./types";

/**
 * How a couple's joint figures are divided for the married-filing-separately
 * comparison. Each value is spouse 1's percentage (0 to 100); spouse 2 gets
 * the remainder.
 */
export interface SplitConfig {
  wages: number;
  stcg: number;
  ltcg: number;
  dividends: number; // Also applies to interest
  contributions401k: number;
  preTaxMedical: number;
  deductions: number;
}

// Spouse 1's percentage of the wages to start the comparison from: what the
// spouse's wages say when they were entered, otherwise an even split
export function defaultWagesSplit(inputs: TaxInputs): number {
  const spouse = spouseWages(inputs);
  if (spouse <= 0) {
    return 50;
  }
  return ((inputs.federalIncome - spouse) / inputs.federalIncome) * 100;
}

// Build one spouse's inputs for the married-filing-separately comparison.
// Each split is spouse 1's percentage; spouse 2 gets the remainder.
export function buildSpouseInputs(
  inputs: TaxInputs,
  splits: SplitConfig,
  isSpouse1: boolean,
): TaxInputs {
  const share = (spouse1Percent: number) =>
    (isSpouse1 ? spouse1Percent : 100 - spouse1Percent) / 100;
  const contributions401k = share(splits.contributions401k);
  const deductions = share(splits.deductions);
  const dividends = share(splits.dividends);
  const ltcg = share(splits.ltcg);
  const preTaxMedical = share(splits.preTaxMedical);
  const stcg = share(splits.stcg);
  const wages = share(splits.wages);

  return {
    ...inputs,
    filingStatus: "marriedFilingSeparately",
    federalIncome: inputs.federalIncome * wages,
    stateIncome: inputs.stateIncome * wages,
    supplementalWages: inputs.supplementalWages * wages,
    spouseWages: 0, // Each separate return has one earner
    selfEmploymentIncome: (inputs.selfEmploymentIncome || 0) * wages,
    shortTermCapitalGains: inputs.shortTermCapitalGains * stcg,
    longTermCapitalGains: inputs.longTermCapitalGains * ltcg,
    interestIncome: inputs.interestIncome * dividends,
    treasuryInterest: inputs.treasuryInterest * dividends,
    ordinaryDividends: inputs.ordinaryDividends * dividends,
    qualifiedDividends: inputs.qualifiedDividends * dividends,
    // Credits follow the investments: the common one is foreign tax on them
    federalTaxCredits: inputs.federalTaxCredits * dividends,
    contributions401k: inputs.contributions401k * contributions401k,
    preTaxMedical: inputs.preTaxMedical * preTaxMedical,
    mortgageInterestPaid: inputs.mortgageInterestPaid * deductions,
    mortgageBalance: inputs.mortgageBalance * deductions,
    propertyTaxesPaid: inputs.propertyTaxesPaid * deductions,
    charitableContributions: inputs.charitableContributions * deductions,
    priorYearShortTermLossCarryover:
      inputs.priorYearShortTermLossCarryover * stcg,
    priorYearLongTermLossCarryover:
      inputs.priorYearLongTermLossCarryover * ltcg,
    federalTaxWithheld: inputs.federalTaxWithheld * wages,
    stateTaxWithheld: inputs.stateTaxWithheld * wages,
    federalEstimatedPaid: inputs.federalEstimatedPaid * wages,
    stateEstimatedPaid: inputs.stateEstimatedPaid * wages,
    priorYearFederalTax: inputs.priorYearFederalTax * wages,
    priorYearStateTax: inputs.priorYearStateTax * wages,
    priorYearStateBalancePaid: inputs.priorYearStateBalancePaid * wages,
  };
}
