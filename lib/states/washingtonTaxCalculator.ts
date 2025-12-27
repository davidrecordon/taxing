import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  WashingtonLimitsData,
  DeductionBreakdown,
  BracketBreakdown,
} from '../types';
import { calculatePaymentSummary, calculateSafeHarbor } from './stateCalcUtils';

/**
 * Washington State Tax Calculator
 *
 * Washington has NO income tax on wages or short-term capital gains.
 * Long-term capital gains are taxed with the following tiered structure:
 * - $0 - $278,000: Exempt (0%)
 * - $278,001 - $1,000,000: 7%
 * - Over $1,000,000: 9.9% (7% + 2.9% surtax)
 *
 * Exempt from WA capital gains tax:
 * - Real estate
 * - Retirement account gains
 * - Short-term capital gains (held < 1 year)
 *
 * Safe harbor: Pay 80% of current year tax to avoid substantial underpayment penalty
 */
export function calculateWashingtonTax(
  inputs: TaxInputs,
  washingtonBrackets: TaxBracketsData,
  washingtonLimits: WashingtonLimitsData
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Use federal income if state income is not specified
  const stateIncome = inputs.stateIncome || inputs.federalIncome;

  // Washington only taxes LONG-TERM capital gains
  // Short-term gains and wages are NOT taxed
  const grossIncome =
    stateIncome +
    inputs.shortTermCapitalGains +
    inputs.longTermCapitalGains;

  // Apply long-term loss carryover to LTCG only
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, inputs.longTermCapitalGains);
  const netLTCG = Math.max(0, inputs.longTermCapitalGains - longTermLossCarryoverOffset);

  // Get the brackets for the filing status
  const brackets = washingtonBrackets.brackets[filingStatus];

  // Calculate tax using bracket data and build breakdown
  const ltcgBracketBreakdown: BracketBreakdown[] = [];
  let totalTax = 0;
  let remainingGains = netLTCG;

  for (const bracket of brackets) {
    if (remainingGains <= 0) break;

    const bracketMax = bracket.max ?? Infinity;
    const bracketSize = bracketMax - bracket.min;
    const gainsInBracket = Math.min(remainingGains, bracketSize);

    if (gainsInBracket > 0) {
      const taxForBracket = gainsInBracket * bracket.rate;
      totalTax += taxForBracket;

      ltcgBracketBreakdown.push({
        bracketMin: bracket.min,
        bracketMax: bracket.max,
        rate: bracket.rate,
        incomeInBracket: gainsInBracket,
        taxForBracket,
      });

      remainingGains -= gainsInBracket;
    }
  }

  // Calculate taxable LTCG (after exemption, for display)
  const taxableLTCG = Math.max(0, netLTCG - washingtonLimits.exemption);

  // Calculate payments using shared utility
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid
  );

  // Washington safe harbor: 80% of current year tax (simpler than CA/Federal)
  // No prior year comparison needed, no quarterly estimated payments required
  const waSafeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    0, // WA doesn't use prior year comparison
    { currentYearPercent: washingtonLimits.safeHarbor.percent }
  );

  // Create empty deduction breakdown (WA doesn't have standard/itemized deductions)
  const emptyDeductionBreakdown: DeductionBreakdown = {
    standardDeduction: 0,
    itemizedDeduction: 0,
    deductionUsed: 'standard',
    deductionAmount: 0,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
  };

  return {
    wageIncome: stateIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    grossIncome,
    shortTermLossCarryoverOffset: 0, // WA doesn't tax short-term gains
    longTermLossCarryoverOffset,
    contributions401k: 0, // Not relevant for WA capital gains tax
    adjustedGrossIncome: 0, // Not applicable for WA (no income tax)
    deductionBreakdown: emptyDeductionBreakdown,
    taxableOrdinaryIncome: 0, // WA has no ordinary income tax
    taxableLTCG,
    ordinaryIncomeBracketBreakdown: [], // No income tax brackets
    ltcgBracketBreakdown,
    ordinaryIncomeTax: 0,
    ltcgTax: totalTax,
    totalTax,
    withheld: inputs.stateTaxWithheld,
    estimatedPaid: inputs.stateEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor: waSafeHarbor,
  };
}
