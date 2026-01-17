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

  // Clamp negative capital gains to 0 (current year losses become carryover)
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const currentYearSTLoss = Math.max(0, -inputs.shortTermCapitalGains);

  // Step 1: Calculate Gross Income
  // California taxes ALL capital gains and self-employment income as ordinary income
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const grossIncome =
    stateIncome + effectiveSTCG + effectiveLTCG + selfEmploymentIncome;

  // Step 1b: Apply short-term loss carryover (includes current year losses, CA follows federal rules)
  // First offset short-term gains, then ordinary income up to limit
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

  // Step 1c: Apply long-term loss carryover (CA taxes all gains as ordinary, so reduces gross income)
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, effectiveLTCG);

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
    preTaxDeductions -
    deductionBreakdown.deductionAmount;

  // Step 4: Calculate taxable income (same as AGI for CA since all deductions are included)
  const taxableOrdinaryIncome = Math.max(0, adjustedGrossIncome);

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
  const caAgiForThreshold =
    grossIncome -
    shortTermLossCarryoverOffset -
    longTermLossCarryoverOffset -
    preTaxDeductions;
  const isHighIncome = caAgiForThreshold > highIncomeThreshold;

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
