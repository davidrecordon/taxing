import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracket,
  BracketBreakdown,
  TaxBracketsData,
  DeductionsData,
  LimitsData,
  SafeHarbor,
} from './types';
import { calculateCaliforniaDeductions } from './deductionCalculator';

function calculateTaxByBrackets(
  taxableIncome: number,
  brackets: TaxBracket[]
): { total: number; breakdown: BracketBreakdown[] } {
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  const breakdown: BracketBreakdown[] = [];

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize =
      bracket.max !== null ? bracket.max - bracket.min : Infinity;

    const incomeInBracket = Math.min(remainingIncome, bracketSize);
    const taxForBracket = incomeInBracket * bracket.rate;

    if (incomeInBracket > 0) {
      breakdown.push({
        bracketMin: bracket.min,
        bracketMax: bracket.max,
        rate: bracket.rate,
        incomeInBracket,
        taxForBracket,
      });
    }

    totalTax += taxForBracket;
    remainingIncome -= incomeInBracket;
  }

  return { total: totalTax, breakdown };
}

export function calculateCaliforniaTax(
  inputs: TaxInputs,
  californiaBrackets: TaxBracketsData,
  californiaDeductions: DeductionsData,
  limits: LimitsData
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Use federal income if California income is not specified
  const californiaIncome = inputs.californiaIncome || inputs.federalIncome;

  // Step 1: Calculate Gross Income
  // California taxes ALL capital gains as ordinary income
  const grossIncome =
    californiaIncome +
    inputs.shortTermCapitalGains +
    inputs.longTermCapitalGains;

  // Step 1b: Apply short-term loss carryover (CA follows federal rules)
  // First offset short-term gains, then ordinary income up to limit
  const stCarryover = inputs.priorYearShortTermLossCarryover;
  const stGainsOffset = Math.min(stCarryover, inputs.shortTermCapitalGains);
  const remainingCarryover = stCarryover - stGainsOffset;

  const ordinaryIncomeLimit = filingStatus === 'marriedFilingSeparately' ? 1500 : 3000;
  const ordinaryIncomeOffset = remainingCarryover > 0 && californiaIncome > 0
    ? Math.min(remainingCarryover, ordinaryIncomeLimit, californiaIncome)
    : 0;

  const shortTermLossCarryoverOffset = stGainsOffset + ordinaryIncomeOffset;

  // Step 1c: Apply long-term loss carryover (CA taxes all gains as ordinary, so reduces gross income)
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, inputs.longTermCapitalGains);

  // Step 3: Calculate deductions (CA doesn't allow SALT)
  const deductionBreakdown = calculateCaliforniaDeductions(
    {
      propertyTaxesPaid: inputs.propertyTaxesPaid,
      mortgageInterestPaid: inputs.mortgageInterestPaid,
      mortgageBalance: inputs.mortgageBalance,
      charitableContributions: inputs.charitableContributions,
      californiaTaxWithheld: inputs.californiaTaxWithheld,
      californiaEstimatedPaid: inputs.californiaEstimatedPaid,
    },
    filingStatus,
    californiaDeductions,
    limits
  );

  // Step 3b: Calculate AGI (includes all deductions for display)
  const adjustedGrossIncome = grossIncome
    - shortTermLossCarryoverOffset
    - longTermLossCarryoverOffset
    - inputs.contributions401k
    - deductionBreakdown.deductionAmount;

  // Step 4: Calculate taxable income (same as AGI for CA since all deductions are included)
  const taxableOrdinaryIncome = Math.max(0, adjustedGrossIncome);

  // Step 5: Calculate tax (all income taxed as ordinary in CA)
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    californiaBrackets.brackets[filingStatus]
  );

  // Step 6: Calculate Mental Health Services Tax (1% on taxable income over $1M)
  const mentalHealthThreshold = 1000000;
  const mentalHealthTax = taxableOrdinaryIncome > mentalHealthThreshold
    ? (taxableOrdinaryIncome - mentalHealthThreshold) * 0.01
    : 0;

  const totalTax = ordinaryTax.total + mentalHealthTax;

  // Step 7: Calculate remaining owed
  const totalPaid = inputs.californiaTaxWithheld + inputs.californiaEstimatedPaid;
  const remainingOwed = Math.max(0, totalTax - totalPaid);
  const refundDue = Math.max(0, totalPaid - totalTax);

  // Step 8: Calculate safe harbor
  // CA uses 100% prior year (not 110% like federal)
  // High income exception: AGI > $1M (single/MFJ) or $500K (MFS) - only 90% current year applies
  const highIncomeThreshold = filingStatus === 'marriedFilingSeparately' ? 500000 : 1000000;
  const caAgiForThreshold = grossIncome - shortTermLossCarryoverOffset - longTermLossCarryoverOffset - inputs.contributions401k;
  const isHighIncome = caAgiForThreshold > highIncomeThreshold;

  const safeHarbor90Percent = totalTax * 0.90;
  const safeHarbor100Percent = inputs.priorYearCaliforniaTaxPaid * 1.00;
  const safeHarborMinimum = isHighIncome || inputs.priorYearCaliforniaTaxPaid === 0
    ? safeHarbor90Percent
    : Math.min(safeHarbor90Percent, safeHarbor100Percent);

  const safeHarbor: SafeHarbor = {
    currentYear90Percent: safeHarbor90Percent,
    priorYear110Percent: safeHarbor100Percent,  // Reusing field, CA uses 100%
    minimum: safeHarborMinimum,
    met: totalPaid >= safeHarborMinimum,
    remaining: Math.max(0, safeHarborMinimum - totalPaid),
    highIncomeException: isHighIncome,
  };

  return {
    wageIncome: californiaIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    grossIncome,
    shortTermLossCarryoverOffset,
    longTermLossCarryoverOffset,
    contributions401k: inputs.contributions401k,
    adjustedGrossIncome,
    deductionBreakdown,
    taxableOrdinaryIncome,
    taxableLTCG: 0, // CA doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: [], // No LTCG brackets for CA
    ordinaryIncomeTax: ordinaryTax.total,
    ltcgTax: mentalHealthTax, // Repurposing this field for mental health tax
    totalTax,
    withheld: inputs.californiaTaxWithheld,
    estimatedPaid: inputs.californiaEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
