import { TaxBracket, BracketBreakdown, TaxCalculationResult } from './types';

/**
 * Calculate effective tax rate as a decimal (e.g., 0.15 for 15%)
 * Returns 0 if income is zero to avoid division by zero
 */
export function calculateEffectiveRate(totalTax: number, income: number): number {
  if (income <= 0) return 0;
  return totalTax / income;
}

/**
 * Calculate both effective tax rates for a tax result
 * - onTaxableIncome: IRS technical definition (tax / taxable income)
 * - onGrossIncome: Intuitive view (tax / gross income)
 */
export function calculateEffectiveRates(result: TaxCalculationResult): {
  onTaxableIncome: number;
  onGrossIncome: number;
} {
  const totalTaxableIncome = result.taxableOrdinaryIncome + result.taxableLTCG;
  return {
    onTaxableIncome: calculateEffectiveRate(result.totalTax, totalTaxableIncome),
    onGrossIncome: calculateEffectiveRate(result.totalTax, result.grossIncome),
  };
}

export function calculateTaxByBrackets(
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
