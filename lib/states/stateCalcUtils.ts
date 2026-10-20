import { FicaData, SafeHarbor, SharedLimitsData, TaxInputs } from "../types";
import {
  netCapitalGains,
  splitDividends,
  stateTaxableInterest,
} from "../taxUtils";

/**
 * Income figures shared by the states that tax all income, including capital
 * gains, as ordinary income.
 */
export interface StateIncome {
  adjustedGrossIncome: number;
  deductibleSETax: number;
  grossIncome: number;
  interestIncome: number;
  longTermLossCarryoverOffset: number;
  ordinaryDividends: number;
  selfEmploymentIncome: number;
  shortTermLossCarryoverOffset: number;
  shortTermLossCarryoverUnused: number;
  stateIncome: number; // Wages: the state override, or the federal amount
}

/**
 * Calculate gross income and AGI for states that tax interest, dividends,
 * self-employment income, and all capital gains as ordinary income.
 * Capital losses are netted following federal Schedule D rules, and AGI
 * follows the federal above-the-line deductions (401(k), pre-tax medical,
 * and the deductible half of self-employment tax).
 */
export function calculateStateIncome(
  inputs: TaxInputs,
  sharedLimits: SharedLimitsData,
  ficaData?: FicaData,
): StateIncome {
  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  // U.S. Treasury interest is exempt from state income tax
  const interestIncome = stateTaxableInterest(inputs);
  const ordinaryDividends = splitDividends(inputs).ordinary;
  const otherIncome =
    stateIncome + selfEmploymentIncome + interestIncome + ordinaryDividends;

  const capitalGains = netCapitalGains(
    inputs,
    inputs.filingStatus,
    sharedLimits,
    otherIncome,
  );
  const grossIncome =
    otherIncome + capitalGains.shortTermGains + capitalGains.longTermGains;

  const deductibleSETax = ficaData
    ? calculateDeductibleSETax(
        selfEmploymentIncome,
        inputs.federalIncome,
        ficaData,
      )
    : 0;

  return {
    adjustedGrossIncome:
      grossIncome -
      capitalGains.shortTermLossOffset -
      capitalGains.longTermLossOffset -
      inputs.contributions401k -
      inputs.preTaxMedical -
      deductibleSETax,
    deductibleSETax,
    grossIncome,
    interestIncome,
    longTermLossCarryoverOffset: capitalGains.longTermLossOffset,
    ordinaryDividends,
    selfEmploymentIncome,
    shortTermLossCarryoverOffset: capitalGains.shortTermLossOffset,
    shortTermLossCarryoverUnused: capitalGains.shortTermLossUnused,
    stateIncome,
  };
}

/**
 * Calculate deductible portion of self-employment tax for state calculations.
 * This is an above-the-line deduction that most states conform to.
 */
export function calculateDeductibleSETax(
  selfEmploymentIncome: number,
  wageIncome: number,
  ficaData: FicaData,
): number {
  if (selfEmploymentIncome <= 0) return 0;

  const seData = ficaData.selfEmployment;
  const netEarnings = selfEmploymentIncome * seData.netEarningsRate;

  // Social Security: 12.4% up to remaining wage base after W-2 wages
  const remainingSsRoom = Math.max(
    0,
    ficaData.socialSecurity.wageBaseCap - wageIncome,
  );
  const ssEarnings = Math.min(netEarnings, remainingSsRoom);
  const socialSecurityTax = ssEarnings * seData.socialSecurityRate;

  // Medicare: 2.9% on all net earnings
  const medicareTax = netEarnings * seData.medicareRate;

  // Deductible half of SE tax
  return (socialSecurityTax + medicareTax) * seData.deductiblePortion;
}

/**
 * Calculate payment summary - identical logic used by all calculators
 */
export function calculatePaymentSummary(
  totalTax: number,
  withheld: number,
  estimatedPaid: number,
): { totalPaid: number; remainingOwed: number; refundDue: number } {
  const totalPaid = withheld + estimatedPaid;
  const remainingOwed = Math.max(0, totalTax - totalPaid);
  const refundDue = Math.max(0, totalPaid - totalTax);

  return { totalPaid, remainingOwed, refundDue };
}

/**
 * Configuration for safe harbor calculation - varies by jurisdiction
 */
export interface SafeHarborConfig {
  /** Current year percentage (0.90 for federal/CA, 0.80 for WA) */
  currentYearPercent: number;
  /** Share of last year's tax required (undefined when not used, as for WA) */
  priorYearPercent?: number;
  /** High income threshold for exception (CA only) */
  highIncomeThreshold?: number;
  /** Whether high income exception applies (only 90% current year) */
  isHighIncome?: boolean;
}

/**
 * Calculate safe harbor for estimated tax penalty avoidance
 *
 * The required amount is the lesser of a share of this year's tax and a share
 * of last year's tax; the shares come from each jurisdiction's limits data
 * (see selectPriorYearPercent). This is one annual comparison: the timing of
 * individual installments is not modelled.
 */
export function calculateSafeHarbor(
  totalTax: number,
  totalPaid: number,
  priorYearTax: number,
  config: SafeHarborConfig,
): SafeHarbor {
  const currentYearSafeHarbor = totalTax * config.currentYearPercent;

  // Calculate prior year safe harbor if applicable
  const priorYearSafeHarbor =
    config.priorYearPercent !== undefined
      ? priorYearTax * config.priorYearPercent
      : 0;

  // Determine minimum: use prior year comparison only if:
  // 1. Prior year percentage is defined
  // 2. Prior year tax was entered
  // 3. Not a high-income exception (CA only)
  let minimum: number;
  if (
    config.priorYearPercent !== undefined &&
    priorYearTax > 0 &&
    !config.isHighIncome
  ) {
    minimum = Math.min(currentYearSafeHarbor, priorYearSafeHarbor);
  } else {
    minimum = currentYearSafeHarbor;
  }

  return {
    currentYear90Percent: currentYearSafeHarbor,
    priorYearSafeHarbor,
    minimum,
    met: totalPaid >= minimum,
    remaining: Math.max(0, minimum - totalPaid),
    priorYearPercent: config.priorYearPercent,
    highIncomeException: config.isHighIncome,
  };
}

/**
 * Share of last year's tax required for the prior-year safe harbor. Most
 * jurisdictions require more when last year's income was over $150,000
 * ($75,000 married filing separately). The calculator cannot know last year's
 * income, so the user says which side they were on; unanswered is treated as
 * over, which is the safer assumption.
 */
export function selectPriorYearPercent(
  safeHarbor: { highIncomePriorYearPercent?: number; priorYearPercent: number },
  inputs: Pick<TaxInputs, "priorYearIncomeOverThreshold">,
): number {
  return (inputs.priorYearIncomeOverThreshold ?? true)
    ? (safeHarbor.highIncomePriorYearPercent ?? safeHarbor.priorYearPercent)
    : safeHarbor.priorYearPercent;
}
