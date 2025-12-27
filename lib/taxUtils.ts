import { TaxBracket, BracketBreakdown } from './types';

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
