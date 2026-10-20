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
  calculateDeductibleSETax,
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateGrossIncome,
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

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;

  // Interest, dividends, self-employment income, and all capital gains are
  // taxed as ordinary income (capital losses follow federal Schedule D rules)
  const {
    grossIncome,
    interestIncome,
    longTermLossCarryoverOffset,
    ordinaryDividends,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
  } = calculateStateGrossIncome(inputs, stateIncome, sharedLimits);

  // Step 2: Calculate AGI
  // DC conforms to federal above-the-line deductions including deductible SE tax
  const deductibleSETax = ficaData
    ? calculateDeductibleSETax(
        selfEmploymentIncome,
        inputs.federalIncome,
        ficaData,
      )
    : 0;
  const preTaxDeductions =
    inputs.contributions401k + inputs.preTaxMedical + deductibleSETax;
  const adjustedGrossIncome =
    grossIncome -
    shortTermLossCarryoverOffset -
    longTermLossCarryoverOffset -
    preTaxDeductions;

  // Step 3: Calculate deductions
  const deductionBreakdown = calculateDCDeductions(
    {
      propertyTaxesPaid: inputs.propertyTaxesPaid,
      mortgageInterestPaid: inputs.mortgageInterestPaid,
      mortgageBalance: inputs.mortgageBalance,
      charitableContributions: inputs.charitableContributions,
      stateTaxWithheld: inputs.stateTaxWithheld,
      stateEstimatedPaid: inputs.stateEstimatedPaid,
    },
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
    inputs.priorYearStateTaxPaid,
    {
      currentYearPercent: dcLimits.safeHarbor.currentYearPercent,
      priorYearPercent: dcLimits.safeHarbor.priorYearPercent,
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
