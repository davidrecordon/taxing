import { SafeHarbor } from '../types';

/**
 * Calculate payment summary - identical logic used by all calculators
 */
export function calculatePaymentSummary(
  totalTax: number,
  withheld: number,
  estimatedPaid: number
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
  /** Prior year percentage (1.10 for federal, 1.00 for CA, undefined for WA) */
  priorYearPercent?: number;
  /** High income threshold for exception (CA only) */
  highIncomeThreshold?: number;
  /** Whether high income exception applies (only 90% current year) */
  isHighIncome?: boolean;
}

/**
 * Calculate safe harbor for estimated tax penalty avoidance
 *
 * Rules by jurisdiction:
 * - Federal: 90% of current year tax OR 110% of prior year tax
 * - California: 90% current OR 100% prior (only 90% for high income AGI > $1M)
 * - Washington: 80% of current year only (no prior year comparison)
 */
export function calculateSafeHarbor(
  totalTax: number,
  totalPaid: number,
  priorYearTax: number,
  config: SafeHarborConfig
): SafeHarbor {
  const currentYearSafeHarbor = totalTax * config.currentYearPercent;

  // Calculate prior year safe harbor if applicable
  const priorYearSafeHarbor = config.priorYearPercent !== undefined
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
    highIncomeException: config.isHighIncome,
  };
}
