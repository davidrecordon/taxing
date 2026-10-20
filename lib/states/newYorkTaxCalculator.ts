import {
  FilingStatus,
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
 * New York tax benefit recapture (IT-201 tax computation worksheets). Above
 * the AGI threshold the benefit of the lower brackets is phased out over the
 * next $50,000 of NY AGI, tier by tier, until the tax equals a flat rate on
 * all taxable income. Returns the amount to add to the rate schedule tax.
 */
export function calculateTaxBenefitRecapture(
  bracketTax: number,
  taxableIncome: number,
  agi: number,
  filingStatus: FilingStatus,
  newYorkLimits: NewYorkLimitsData,
): number {
  const recapture = newYorkLimits.taxBenefitRecapture;
  if (agi <= recapture.agiThreshold || taxableIncome <= 0) return 0;

  if (agi > recapture.topRateAgiThreshold) {
    return Math.max(0, taxableIncome * recapture.topRate - bracketTax);
  }

  // The worksheets round the phase-in fraction to four decimal places
  const phaseIn = (start: number) =>
    Math.round(
      (Math.min(Math.max(0, agi - start), recapture.phaseInRange) /
        recapture.phaseInRange) *
        10000,
    ) / 10000;

  const tier = recapture.tiers[filingStatus].findLast(
    (candidate) => taxableIncome > candidate.minTaxableIncome,
  );
  if (!tier) {
    // First tier: phase toward the flat rate on all taxable income
    const flatTax = taxableIncome * recapture.firstTierRate[filingStatus];
    return Math.max(0, flatTax - bracketTax) * phaseIn(recapture.agiThreshold);
  }

  return (
    tier.recaptureBase +
    tier.incrementalBenefit * phaseIn(tier.minTaxableIncome)
  );
}

/**
 * New York City school tax credit (IT-201 lines 69 and 69a): a fixed amount
 * for lower incomes plus a rate reduction amount based on city taxable income.
 */
export function calculateNYCSchoolTaxCredit(
  taxableIncome: number,
  agi: number,
  filingStatus: FilingStatus,
  newYorkLimits: NewYorkLimitsData,
): number {
  const { fixedAmount, fixedAmountIncomeLimit, rateReduction } =
    newYorkLimits.nycSchoolTaxCredit;
  const key =
    filingStatus === "marriedFilingJointly"
      ? "marriedFilingJointly"
      : "default";

  const fixed = agi <= fixedAmountIncomeLimit ? fixedAmount[key] : 0;

  let reduction = 0;
  if (taxableIncome > 0 && taxableIncome <= rateReduction.incomeLimit) {
    const threshold = rateReduction.threshold[key];
    reduction =
      taxableIncome <= threshold
        ? taxableIncome * rateReduction.baseRate
        : rateReduction.baseAmount[key] +
          (taxableIncome - threshold) * rateReduction.excessRate;
  }

  return fixed + reduction;
}

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

  // Step 5b: Tax benefit recapture for higher incomes
  const nyTaxBenefitRecapture = calculateTaxBenefitRecapture(
    nyStateTax.total,
    taxableOrdinaryIncome,
    adjustedGrossIncome,
    filingStatus,
    newYorkLimits,
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

  // Step 6b: NYC school tax credit, limited to the city tax
  const nycSchoolTaxCredit = isNYCResident
    ? Math.min(
        nycTax,
        calculateNYCSchoolTaxCredit(
          taxableOrdinaryIncome,
          adjustedGrossIncome,
          filingStatus,
          newYorkLimits,
        ),
      )
    : 0;

  const totalTax =
    nyStateTax.total + nyTaxBenefitRecapture + nycTax - nycSchoolTaxCredit;

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
    inputs.priorYearStateTax,
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
    nyTaxBenefitRecapture,
    nycTax: isNYCResident ? nycTax : undefined,
    nycSchoolTaxCredit: isNYCResident ? nycSchoolTaxCredit : undefined,
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
