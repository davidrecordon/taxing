import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionsData,
  SharedLimitsData,
  CaliforniaLimitsData,
  FicaData,
} from "../types";
import { calculateCaliforniaDeductions } from "../deductionCalculator";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateIncome,
  selectPriorYearPercent,
} from "./stateCalcUtils";

export function calculateCaliforniaTax(
  inputs: TaxInputs,
  californiaBrackets: TaxBracketsData,
  californiaDeductions: DeductionsData,
  sharedLimits: SharedLimitsData,
  californiaLimits: CaliforniaLimitsData,
  ficaData?: FicaData,
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

  // Step 3b: Calculate deductions (property tax allowed, state income tax not)
  const deductionBreakdown = calculateCaliforniaDeductions(
    inputs,
    filingStatus,
    californiaDeductions,
    californiaLimits,
    adjustedGrossIncome,
  );

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(
    0,
    adjustedGrossIncome - deductionBreakdown.deductionAmount,
  );

  // Step 5: Calculate tax (all income taxed as ordinary in CA)
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    californiaBrackets.brackets[filingStatus],
  );

  // Step 6: Calculate Mental Health Services Tax (1% on taxable income over $1M)
  const mentalHealthThreshold = californiaLimits.mentalHealthTax.threshold;
  const mentalHealthTax =
    taxableOrdinaryIncome > mentalHealthThreshold
      ? (taxableOrdinaryIncome - mentalHealthThreshold) *
        californiaLimits.mentalHealthTax.rate
      : 0;

  const totalTax = ordinaryTax.total + mentalHealthTax;

  // Step 7: Calculate remaining owed using shared utility
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid,
  );

  // Step 8: Calculate safe harbor using shared utility
  // CA requires 100% of last year's tax, or 110% if last year's income was
  // over $150,000. At $1M or more of this year's AGI ($500K MFS) the
  // prior-year method is unavailable and only 90% of this year's tax applies.
  const priorYearUnavailableAgi =
    filingStatus === "marriedFilingSeparately"
      ? californiaLimits.safeHarbor.priorYearUnavailableAgi
          .marriedFilingSeparately
      : californiaLimits.safeHarbor.priorYearUnavailableAgi.default;
  const isHighIncome = adjustedGrossIncome >= priorYearUnavailableAgi;

  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTax,
    {
      currentYearPercent: californiaLimits.safeHarbor.currentYearPercent,
      priorYearPercent: selectPriorYearPercent(
        californiaLimits.safeHarbor,
        inputs,
      ),
      isHighIncome,
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
    taxableLTCG: 0, // CA doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: [], // No LTCG brackets for CA
    ordinaryIncomeTax: ordinaryTax.total,
    ltcgTax: 0,
    caMentalHealthTax: mentalHealthTax,
    totalTax,
    withheld: inputs.stateTaxWithheld,
    estimatedPaid: inputs.stateEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
