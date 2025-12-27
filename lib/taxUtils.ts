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

/**
 * Calculate LTCG tax with proper stacking on ordinary income.
 * LTCG brackets are based on TOTAL taxable income, so ordinary income
 * "fills up" the lower brackets first, then LTCG is taxed starting
 * where ordinary income ends.
 *
 * Example: Single filer with $40k ordinary + $20k LTCG
 * - 0% threshold is $47,025
 * - Ordinary income fills first $40k
 * - Only $7,025 room left in 0% bracket for LTCG
 * - First $7,025 LTCG → 0%, remaining $12,975 → 15%
 */
export function calculateLTCGTaxWithStacking(
  ltcg: number,
  ordinaryTaxableIncome: number,
  ltcgBrackets: TaxBracket[]
): { total: number; breakdown: BracketBreakdown[]; ltcgInZeroBracket: number } {
  if (ltcg <= 0) {
    return { total: 0, breakdown: [], ltcgInZeroBracket: 0 };
  }

  let remainingLTCG = ltcg;
  let currentPosition = ordinaryTaxableIncome;
  let totalTax = 0;
  const breakdown: BracketBreakdown[] = [];
  let ltcgInZeroBracket = 0;

  for (const bracket of ltcgBrackets) {
    if (remainingLTCG <= 0) break;

    const bracketEnd = bracket.max ?? Infinity;

    // Skip brackets we've already passed with ordinary income
    if (currentPosition >= bracketEnd) continue;

    // How much room is left in this bracket?
    const roomInBracket = bracketEnd - currentPosition;
    const ltcgInThisBracket = Math.min(remainingLTCG, roomInBracket);

    if (ltcgInThisBracket > 0) {
      const taxForBracket = ltcgInThisBracket * bracket.rate;

      // Track how much LTCG falls in the 0% bracket
      if (bracket.rate === 0) {
        ltcgInZeroBracket = ltcgInThisBracket;
      }

      breakdown.push({
        bracketMin: bracket.min,
        bracketMax: bracket.max,
        rate: bracket.rate,
        incomeInBracket: ltcgInThisBracket,
        taxForBracket,
      });

      totalTax += taxForBracket;
      currentPosition += ltcgInThisBracket;
      remainingLTCG -= ltcgInThisBracket;
    }
  }

  return { total: totalTax, breakdown, ltcgInZeroBracket };
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
