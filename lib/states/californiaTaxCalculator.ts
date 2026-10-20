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
  calculateDeductibleSETax,
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateGrossIncome,
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

  // Step 3: Calculate deductions (CA doesn't allow SALT)
  const deductionBreakdown = calculateCaliforniaDeductions(
    {
      propertyTaxesPaid: inputs.propertyTaxesPaid,
      mortgageInterestPaid: inputs.mortgageInterestPaid,
      mortgageBalance: inputs.mortgageBalance,
      charitableContributions: inputs.charitableContributions,
      stateTaxWithheld: inputs.stateTaxWithheld,
      stateEstimatedPaid: inputs.stateEstimatedPaid,
    },
    filingStatus,
    californiaDeductions,
    californiaLimits,
  );

  // Step 3b: Calculate AGI (includes all deductions for display)
  // CA conforms to federal above-the-line deductions including deductible SE tax
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
  // CA uses 100% prior year (not 110% like federal)
  // High income exception: AGI > $1M (single/MFJ) or $500K (MFS) - only 90% current year applies
  const highIncomeThreshold =
    filingStatus === "marriedFilingSeparately"
      ? californiaLimits.safeHarbor.highIncomeThresholdMFS
      : californiaLimits.safeHarbor.highIncomeThreshold;
  const isHighIncome = adjustedGrossIncome > highIncomeThreshold;

  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTaxPaid,
    {
      currentYearPercent: californiaLimits.safeHarbor.currentYearPercent,
      priorYearPercent: californiaLimits.safeHarbor.priorYearPercent,
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
