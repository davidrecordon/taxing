import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  SharedLimitsData,
  ColoradoLimitsData,
  DeductionBreakdown,
  FicaData,
} from "../types";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculateDeductibleSETax,
  calculatePaymentSummary,
  calculateSafeHarbor,
} from "./stateCalcUtils";

/**
 * Colorado State Tax Calculator
 *
 * Colorado has a flat 4.4% income tax rate (effective 2025).
 * Colorado uses federal taxable income as the starting point, meaning:
 * - Federal standard/itemized deductions are already applied
 * - 401k and pre-tax medical are already deducted
 *
 * All capital gains are taxed as ordinary income at the flat rate.
 *
 * Safe harbor: 90% of current year tax OR 100% of prior year tax
 */
export function calculateColoradoTax(
  inputs: TaxInputs,
  coloradoBrackets: TaxBracketsData,
  sharedLimits: SharedLimitsData,
  coloradoLimits: ColoradoLimitsData,
  federalTaxableIncome: number,
  ficaData?: FicaData,
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Clamp negative capital gains to 0 (current year losses become carryover)
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const currentYearSTLoss = Math.max(0, -inputs.shortTermCapitalGains);

  // Calculate gross income for display purposes
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const grossIncome =
    stateIncome + effectiveSTCG + effectiveLTCG + selfEmploymentIncome;

  // Apply short-term loss carryover
  const stCarryover =
    inputs.priorYearShortTermLossCarryover + currentYearSTLoss;
  const stGainsOffset = Math.min(stCarryover, effectiveSTCG);
  const remainingCarryover = stCarryover - stGainsOffset;

  const ordinaryIncomeLimit =
    filingStatus === "marriedFilingSeparately"
      ? sharedLimits.capitalLossLimit.marriedFilingSeparately
      : sharedLimits.capitalLossLimit.default;
  const ordinaryIncomeOffset =
    remainingCarryover > 0 && stateIncome > 0
      ? Math.min(remainingCarryover, ordinaryIncomeLimit, stateIncome)
      : 0;

  const shortTermLossCarryoverOffset = stGainsOffset + ordinaryIncomeOffset;
  const shortTermLossCarryoverUnused =
    stCarryover - shortTermLossCarryoverOffset;

  // Apply long-term loss carryover
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, effectiveLTCG);

  // Calculate deductible SE tax for display
  const deductibleSETax = ficaData
    ? calculateDeductibleSETax(
        selfEmploymentIncome,
        inputs.federalIncome,
        ficaData,
      )
    : 0;

  // Colorado uses federal taxable income as the starting point
  // This already includes federal deductions, so we just apply the flat rate
  const taxableIncome = Math.max(0, federalTaxableIncome);

  // Calculate tax using flat rate (single bracket)
  const ordinaryTax = calculateTaxByBrackets(
    taxableIncome,
    coloradoBrackets.brackets[filingStatus],
  );

  const totalTax = ordinaryTax.total;

  // Calculate remaining owed
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid,
  );

  // Calculate safe harbor
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTaxPaid,
    {
      currentYearPercent: coloradoLimits.safeHarbor.currentYearPercent,
      priorYearPercent: coloradoLimits.safeHarbor.priorYearPercent,
    },
  );

  // Create deduction breakdown (showing federal deductions used by CO)
  const emptyDeductionBreakdown: DeductionBreakdown = {
    standardDeduction: 0, // CO uses federal taxable income directly
    itemizedDeduction: 0,
    deductionUsed: "standard",
    deductionAmount: 0,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
  };

  return {
    wageIncome: stateIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    grossIncome,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
    longTermLossCarryoverOffset,
    contributions401k: inputs.contributions401k,
    preTaxMedical: inputs.preTaxMedical,
    selfEmploymentIncome:
      selfEmploymentIncome > 0 ? selfEmploymentIncome : undefined,
    deductibleSETax: deductibleSETax > 0 ? deductibleSETax : undefined,
    adjustedGrossIncome: taxableIncome, // For CO, this is federal taxable income
    deductionBreakdown: emptyDeductionBreakdown,
    taxableOrdinaryIncome: taxableIncome,
    taxableLTCG: 0, // CO doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: [],
    ordinaryIncomeTax: ordinaryTax.total,
    ltcgTax: 0,
    totalTax,
    withheld: inputs.stateTaxWithheld,
    estimatedPaid: inputs.stateEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
