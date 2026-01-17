import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionsData,
  SharedLimitsData,
  FederalLimitsData,
  NewYorkLimitsData,
  BracketBreakdown,
  FicaData,
} from "../types";
import { calculateNewYorkDeductions } from "../deductionCalculator";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculateDeductibleSETax,
  calculatePaymentSummary,
  calculateSafeHarbor,
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
  federalLimits: FederalLimitsData,
  newYorkLimits: NewYorkLimitsData,
  ficaData?: FicaData,
): TaxCalculationResult {
  const { filingStatus } = inputs;
  const isNYCResident = inputs.isNYCResident ?? false;

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Clamp negative capital gains to 0 (current year losses become carryover)
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const currentYearSTLoss = Math.max(0, -inputs.shortTermCapitalGains);

  // Step 1: Calculate Gross Income
  // New York taxes ALL capital gains and self-employment income as ordinary income
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const grossIncome =
    stateIncome + effectiveSTCG + effectiveLTCG + selfEmploymentIncome;

  // Step 1b: Apply short-term loss carryover (includes current year losses, NY follows federal rules)
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
    federalLimits,
  );

  // Step 3: Calculate AGI
  // NY conforms to federal above-the-line deductions including deductible SE tax
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
  const nyAgi =
    grossIncome -
    shortTermLossCarryoverOffset -
    longTermLossCarryoverOffset -
    preTaxDeductions;
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
