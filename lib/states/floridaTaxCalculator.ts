import {
  TaxInputs,
  TaxCalculationResult,
  DeductionBreakdown,
} from '../types';
import { calculatePaymentSummary } from './stateCalcUtils';

/**
 * Florida State Tax Calculator
 *
 * Florida has NO state income tax on wages, capital gains, or any personal income.
 * This is one of the few states with no individual income tax.
 *
 * This calculator still tracks withholding and estimated payments to handle
 * any refunds due from erroneous withholding.
 */
export function calculateFloridaTax(
  inputs: TaxInputs
): TaxCalculationResult {
  // Use federal income if state income is not specified (for display purposes)
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Calculate gross income for display purposes
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;

  const grossIncome =
    stateIncome +
    effectiveSTCG +
    effectiveLTCG +
    selfEmploymentIncome;

  // Florida has no income tax, so total tax is always 0
  const totalTax = 0;

  // Calculate payment summary (any withholding becomes a refund)
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid
  );

  // Empty deduction breakdown (no deductions needed when tax is 0)
  const emptyDeductionBreakdown: DeductionBreakdown = {
    standardDeduction: 0,
    itemizedDeduction: 0,
    deductionUsed: 'standard',
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
    shortTermLossCarryoverOffset: 0,
    longTermLossCarryoverOffset: 0,
    contributions401k: 0,
    preTaxMedical: 0,
    adjustedGrossIncome: 0,
    deductionBreakdown: emptyDeductionBreakdown,
    taxableOrdinaryIncome: 0,
    taxableLTCG: 0,
    ordinaryIncomeBracketBreakdown: [],
    ltcgBracketBreakdown: [],
    ordinaryIncomeTax: 0,
    ltcgTax: 0,
    totalTax: 0,
    withheld: inputs.stateTaxWithheld,
    estimatedPaid: inputs.stateEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    // No safe harbor needed when there's no tax
  };
}
