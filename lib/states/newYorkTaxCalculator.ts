import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionsData,
  SharedLimitsData,
  NewYorkLimitsData,
  BracketBreakdown,
  FicaData,
} from "../types";
import { calculateNewYorkDeductions } from "../deductionCalculator";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateIncome,
} from "./stateCalcUtils";

/**
 * New York State Tax Calculator
 *
 * New York taxes ALL income (including capital gains) as ordinary income.
 * NYC residents pay an additional local income tax on top of state tax.
 *
 * Safe harbor rules:
 * - 100% of prior year tax (110% if NYAGI > $150k, or $75k for MFS)
 * - OR 90% of current year tax
 */
export function calculateNewYorkTax(
  inputs: TaxInputs,
  newYorkBrackets: TaxBracketsData,
  nycBrackets: TaxBracketsData,
  newYorkDeductions: DeductionsData,
  sharedLimits: SharedLimitsData,
  newYorkLimits: NewYorkLimitsData,
  ficaData?: FicaData,
): TaxCalculationResult {
  const { filingStatus } = inputs;
  const isNYCResident = inputs.isNYCResident ?? false;

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
  const deductionBreakdown = calculateNewYorkDeductions(
    inputs,
    filingStatus,
    newYorkDeductions,
    newYorkLimits,
    adjustedGrossIncome,
  );

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(
    0,
    adjustedGrossIncome - deductionBreakdown.deductionAmount,
  );

  // Step 5: Calculate NY State tax
  const nyStateTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    newYorkBrackets.brackets[filingStatus],
  );

  // Step 6: Calculate NYC local tax if resident
  let nycTax = 0;
  let nycBracketBreakdown: BracketBreakdown[] = [];

  if (isNYCResident && taxableOrdinaryIncome > 0) {
    const nycTaxResult = calculateTaxByBrackets(
      taxableOrdinaryIncome,
      nycBrackets.brackets[filingStatus],
    );
    nycTax = nycTaxResult.total;
    nycBracketBreakdown = nycTaxResult.breakdown;
  }

  const totalTax = nyStateTax.total + nycTax;

  // Step 7: Calculate remaining owed
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid,
  );

  // Step 8: Calculate safe harbor
  // NY uses 100% prior year (110% if high income)
  const highIncomeThreshold =
    filingStatus === "marriedFilingSeparately"
      ? newYorkLimits.safeHarbor.highIncomeThresholdMFS
      : newYorkLimits.safeHarbor.highIncomeThreshold;
  const isHighIncome = adjustedGrossIncome > highIncomeThreshold;

  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTaxPaid,
    {
      currentYearPercent: newYorkLimits.safeHarbor.currentYearPercent,
      priorYearPercent: isHighIncome
        ? newYorkLimits.safeHarbor.highIncomePercent
        : newYorkLimits.safeHarbor.priorYearPercent,
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
    taxableLTCG: 0, // NY doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: nyStateTax.breakdown,
    ltcgBracketBreakdown: [], // No LTCG brackets for NY
    ordinaryIncomeTax: nyStateTax.total,
    ltcgTax: 0,
    nycTax: isNYCResident ? nycTax : undefined,
    nycBracketBreakdown: isNYCResident ? nycBracketBreakdown : undefined,
    totalTax,
    withheld: inputs.stateTaxWithheld,
    estimatedPaid: inputs.stateEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor: { ...safeHarbor, isHighIncome },
  };
}
