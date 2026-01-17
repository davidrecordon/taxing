import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
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
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Clamp negative capital gains to 0 (current year losses become carryover)
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const currentYearSTLoss = Math.max(0, -inputs.shortTermCapitalGains);

  // Step 1: Calculate Gross Income
  // DC taxes ALL capital gains and self-employment income as ordinary income
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const grossIncome =
    stateIncome + effectiveSTCG + effectiveLTCG + selfEmploymentIncome;

  // Step 1b: Apply short-term loss carryover (includes current year losses, DC follows federal rules)
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

  // Step 1c: Apply long-term loss carryover
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, effectiveLTCG);

  // Step 2: Calculate deductions
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
  );

  // Step 3: Calculate AGI
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
    preTaxDeductions -
    deductionBreakdown.deductionAmount;

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(0, adjustedGrossIncome);

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
