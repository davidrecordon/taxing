import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  SharedLimitsData,
  IllinoisLimitsData,
  IllinoisDeductionsData,
  DeductionBreakdown,
  FicaData,
} from "../types";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculateDeductibleSETax,
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateGrossIncome,
} from "./stateCalcUtils";

/**
 * Illinois State Tax Calculator
 *
 * Illinois has a flat 4.95% income tax rate on all income.
 * Instead of standard deductions, Illinois uses personal exemptions (amounts
 * in data/illinois-deductions.json). The exemption and the 5% property tax
 * credit are not allowed when AGI exceeds $250,000 ($500,000 joint).
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

  // Step 2: Apply pre-tax deductions (401k, medical, and deductible SE tax)
  // IL conforms to federal above-the-line deductions
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

  // Step 3: Apply Illinois personal exemption (instead of standard deduction)
  // The exemption and the property tax credit are lost above the income limit
  const incomeLimit =
    filingStatus === "marriedFilingJointly"
      ? illinoisLimits.incomeLimit.marriedFilingJointly
      : illinoisLimits.incomeLimit.default;
  const overIncomeLimit = adjustedGrossIncome > incomeLimit;
  const personalExemption = overIncomeLimit
    ? 0
    : illinoisDeductions.personalExemption[filingStatus];

  // Step 4: Calculate taxable income
  const taxableOrdinaryIncome = Math.max(
    0,
    adjustedGrossIncome - personalExemption,
  );

  // Step 5: Calculate tax using flat rate (single bracket)
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    illinoisBrackets.brackets[filingStatus],
  );

  // Step 5b: Property tax credit (nonrefundable). Assumes the property tax
  // entered is for an Illinois principal residence.
  const propertyTaxCredit = overIncomeLimit
    ? 0
    : Math.min(
        ordinaryTax.total,
        inputs.propertyTaxesPaid * illinoisLimits.propertyTaxCreditRate,
      );

  const totalTax = ordinaryTax.total - propertyTaxCredit;

  // Step 6: Calculate remaining owed using shared utility
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid,
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
    },
  );

  // Create empty deduction breakdown (IL uses personal exemptions, not std/itemized)
  const emptyDeductionBreakdown: DeductionBreakdown = {
    standardDeduction: personalExemption, // Use personal exemption as "standard"
    itemizedDeduction: 0,
    deductionUsed: "standard",
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
    deductionBreakdown: emptyDeductionBreakdown,
    taxableOrdinaryIncome,
    taxableLTCG: 0, // IL doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: [], // No LTCG brackets for IL
    ordinaryIncomeTax: ordinaryTax.total,
    propertyTaxCredit,
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
