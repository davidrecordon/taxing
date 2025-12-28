import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionsData,
  SharedLimitsData,
  FederalLimitsData,
  NewYorkLimitsData,
  BracketBreakdown,
} from '../types';
import { calculateNewYorkDeductions } from '../deductionCalculator';
import { calculateTaxByBrackets } from '../taxUtils';
import { calculatePaymentSummary, calculateSafeHarbor } from './stateCalcUtils';

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
  federalLimits: FederalLimitsData,
  newYorkLimits: NewYorkLimitsData
): TaxCalculationResult {
  const { filingStatus } = inputs;
  const isNYCResident = inputs.isNYCResident ?? false;

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Step 1: Calculate Gross Income
  // New York taxes ALL capital gains as ordinary income
  const grossIncome =
    stateIncome +
    inputs.shortTermCapitalGains +
    inputs.longTermCapitalGains;

  // Step 1b: Apply short-term loss carryover (NY follows federal rules)
  const stCarryover = inputs.priorYearShortTermLossCarryover;
  const stGainsOffset = Math.min(stCarryover, inputs.shortTermCapitalGains);
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
  const longTermLossCarryoverOffset = Math.min(ltCarryover, inputs.longTermCapitalGains);

  // Step 2: Calculate deductions
  const deductionBreakdown = calculateNewYorkDeductions(
    {
      propertyTaxesPaid: inputs.propertyTaxesPaid,
      mortgageInterestPaid: inputs.mortgageInterestPaid,
      mortgageBalance: inputs.mortgageBalance,
      charitableContributions: inputs.charitableContributions,
      stateTaxWithheld: inputs.stateTaxWithheld,
      stateEstimatedPaid: inputs.stateEstimatedPaid,
    },
    filingStatus,
    newYorkDeductions,
    federalLimits
  );

  // Step 3: Calculate AGI
  const preTaxDeductions = inputs.contributions401k + inputs.preTaxMedical;
  const adjustedGrossIncome = grossIncome
    - shortTermLossCarryoverOffset
    - longTermLossCarryoverOffset
    - preTaxDeductions
    - deductionBreakdown.deductionAmount;

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(0, adjustedGrossIncome);

  // Step 5: Calculate NY State tax
  const nyStateTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    newYorkBrackets.brackets[filingStatus]
  );

  // Step 6: Calculate NYC local tax if resident
  let nycTax = 0;
  let nycBracketBreakdown: BracketBreakdown[] = [];

  if (isNYCResident && taxableOrdinaryIncome > 0) {
    const nycTaxResult = calculateTaxByBrackets(
      taxableOrdinaryIncome,
      nycBrackets.brackets[filingStatus]
    );
    nycTax = nycTaxResult.total;
    nycBracketBreakdown = nycTaxResult.breakdown;
  }

  const totalTax = nyStateTax.total + nycTax;

  // Step 7: Calculate remaining owed
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid
  );

  // Step 8: Calculate safe harbor
  // NY uses 100% prior year (110% if high income)
  const highIncomeThreshold = filingStatus === 'marriedFilingSeparately'
    ? newYorkLimits.safeHarbor.highIncomeThresholdMFS
    : newYorkLimits.safeHarbor.highIncomeThreshold;
  const nyAgi = grossIncome - shortTermLossCarryoverOffset - longTermLossCarryoverOffset - preTaxDeductions;
  const isHighIncome = nyAgi > highIncomeThreshold;

  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTaxPaid,
    {
      currentYearPercent: newYorkLimits.safeHarbor.currentYearPercent,
      priorYearPercent: isHighIncome
        ? newYorkLimits.safeHarbor.highIncomePercent
        : newYorkLimits.safeHarbor.priorYearPercent,
    }
  );

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
