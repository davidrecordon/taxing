import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  SharedLimitsData,
  IllinoisLimitsData,
  IllinoisDeductionsData,
  DeductionBreakdown,
  FicaData,
} from '../types';
import { calculateTaxByBrackets } from '../taxUtils';
import { calculateDeductibleSETax, calculatePaymentSummary, calculateSafeHarbor } from './stateCalcUtils';

/**
 * Illinois State Tax Calculator
 *
 * Illinois has a flat 4.95% income tax rate on all income.
 * Instead of standard deductions, Illinois uses personal exemptions:
 * - Single: $2,850
 * - MFJ: $5,700
 * - MFS: $2,850
 *
 * All capital gains are taxed as ordinary income (like CA).
 *
 * Safe harbor: 90% of current year tax OR 100% of prior year tax
 */
export function calculateIllinoisTax(
  inputs: TaxInputs,
  illinoisBrackets: TaxBracketsData,
  illinoisDeductions: IllinoisDeductionsData,
  sharedLimits: SharedLimitsData,
  illinoisLimits: IllinoisLimitsData,
  ficaData?: FicaData
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Clamp negative capital gains to 0 (current year losses become carryover)
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const currentYearSTLoss = Math.max(0, -inputs.shortTermCapitalGains);

  // Step 1: Calculate Gross Income
  // Illinois taxes ALL capital gains and self-employment income as ordinary income
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const grossIncome =
    stateIncome +
    effectiveSTCG +
    effectiveLTCG +
    selfEmploymentIncome;

  // Step 1b: Apply short-term loss carryover (includes current year losses)
  // First offset short-term gains, then ordinary income up to limit
  const stCarryover = inputs.priorYearShortTermLossCarryover + currentYearSTLoss;
  const stGainsOffset = Math.min(stCarryover, effectiveSTCG);
  const remainingCarryover = stCarryover - stGainsOffset;

  const ordinaryIncomeLimit = filingStatus === 'marriedFilingSeparately'
    ? sharedLimits.capitalLossLimit.marriedFilingSeparately
    : sharedLimits.capitalLossLimit.default;
  const ordinaryIncomeOffset = remainingCarryover > 0 && stateIncome > 0
    ? Math.min(remainingCarryover, ordinaryIncomeLimit, stateIncome)
    : 0;

  const shortTermLossCarryoverOffset = stGainsOffset + ordinaryIncomeOffset;
  const shortTermLossCarryoverUnused = stCarryover - shortTermLossCarryoverOffset;

  // Step 1c: Apply long-term loss carryover
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, effectiveLTCG);

  // Step 2: Apply pre-tax deductions (401k, medical, and deductible SE tax)
  // IL conforms to federal above-the-line deductions
  const deductibleSETax = ficaData
    ? calculateDeductibleSETax(selfEmploymentIncome, inputs.federalIncome, ficaData)
    : 0;
  const preTaxDeductions = inputs.contributions401k + inputs.preTaxMedical + deductibleSETax;

  // Step 3: Apply Illinois personal exemption (instead of standard deduction)
  const personalExemption = illinoisDeductions.personalExemption[filingStatus];

  // Calculate AGI after all deductions
  const adjustedGrossIncome = grossIncome
    - shortTermLossCarryoverOffset
    - longTermLossCarryoverOffset
    - preTaxDeductions
    - personalExemption;

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(0, adjustedGrossIncome);

  // Step 5: Calculate tax using flat rate (single bracket)
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    illinoisBrackets.brackets[filingStatus]
  );

  const totalTax = ordinaryTax.total;

  // Step 6: Calculate remaining owed using shared utility
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid
  );

  // Step 7: Calculate safe harbor using shared utility
  // Illinois uses standard 90% current year or 100% prior year
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTaxPaid,
    {
      currentYearPercent: illinoisLimits.safeHarbor.currentYearPercent,
      priorYearPercent: illinoisLimits.safeHarbor.priorYearPercent,
    }
  );

  // Create empty deduction breakdown (IL uses personal exemptions, not std/itemized)
  const emptyDeductionBreakdown: DeductionBreakdown = {
    standardDeduction: personalExemption, // Use personal exemption as "standard"
    itemizedDeduction: 0,
    deductionUsed: 'standard',
    deductionAmount: personalExemption,
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
    selfEmploymentIncome: selfEmploymentIncome > 0 ? selfEmploymentIncome : undefined,
    deductibleSETax: deductibleSETax > 0 ? deductibleSETax : undefined,
    adjustedGrossIncome,
    deductionBreakdown: emptyDeductionBreakdown,
    taxableOrdinaryIncome,
    taxableLTCG: 0, // IL doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: [], // No LTCG brackets for IL
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
