import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionBreakdown,
  DeductionsData,
  SharedLimitsData,
  FederalLimitsData,
  DCLimitsData,
  FicaData,
} from "../types";
import { calculateDCDeductions } from "../deductionCalculator";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateIncome,
  selectPriorYearPercent,
} from "./stateCalcUtils";

/**
 * Washington DC Tax Calculator
 *
 * DC taxes ALL income (including capital gains) as ordinary income.
 * DC uses progressive brackets (same brackets for all filing statuses).
 *
 * Safe harbor rules:
 * - 110% of prior year tax
 * - OR 90% of current year tax
 */
export function calculateDCTax(
  inputs: TaxInputs,
  dcBrackets: TaxBracketsData,
  dcDeductions: DeductionsData,
  sharedLimits: SharedLimitsData,
  federalLimits: FederalLimitsData,
  dcLimits: DCLimitsData,
  ficaData?: FicaData,
  federalDeduction?: DeductionBreakdown,
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Interest, dividends, self-employment income, and all capital gains are
  // taxed as ordinary income (capital losses follow federal Schedule D rules).
  // AGI follows the federal above-the-line deductions.
  const {
    adjustedGrossIncome,
    deductibleSETax,
    grossIncome,
    interestIncome,
    longTermLossCarryoverOffset,
    ordinaryDividends,
    selfEmploymentIncome,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
    stateIncome,
  } = calculateStateIncome(inputs, sharedLimits, ficaData);

  // Step 3: Calculate deductions
  const deductionBreakdown = calculateDCDeductions(
    inputs,
    filingStatus,
    dcDeductions,
    federalLimits,
    dcLimits,
    adjustedGrossIncome,
    federalDeduction,
  );

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(
    0,
    adjustedGrossIncome - deductionBreakdown.deductionAmount,
  );

  // Step 5: Calculate DC tax
  const dcTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    dcBrackets.brackets[filingStatus],
  );

  const totalTax = dcTax.total;

  // Step 6: Calculate remaining owed
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid,
  );

  // Step 7: Calculate safe harbor
  // DC uses 90% current year OR 110% prior year for everyone
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTax,
    {
      currentYearPercent: dcLimits.safeHarbor.currentYearPercent,
      priorYearPercent: selectPriorYearPercent(dcLimits.safeHarbor, inputs),
    },
  );

  return {
    wageIncome: stateIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    interestIncome,
    ordinaryDividends,
    grossIncome,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
    longTermLossCarryoverOffset,
    contributions401k: inputs.contributions401k,
    preTaxMedical: inputs.preTaxMedical,
    selfEmploymentIncome:
      selfEmploymentIncome > 0 ? selfEmploymentIncome : undefined,
    deductibleSETax: deductibleSETax > 0 ? deductibleSETax : undefined,
    adjustedGrossIncome,
    deductionBreakdown,
    taxableOrdinaryIncome,
    taxableLTCG: 0, // DC doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: dcTax.breakdown,
    ltcgBracketBreakdown: [], // No LTCG brackets for DC
    ordinaryIncomeTax: dcTax.total,
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
