import {
  BracketBreakdown,
  CapitalGainsNetting,
  FilingStatus,
  SharedLimitsData,
  TaxBracket,
  TaxCalculationResult,
  TaxInputs,
} from "./types";

/**
 * Calculate effective tax rate as a decimal (e.g., 0.15 for 15%)
 * Returns 0 if income is zero to avoid division by zero
 */
export function calculateEffectiveRate(
  totalTax: number,
  income: number,
): number {
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
    onTaxableIncome: calculateEffectiveRate(
      result.totalTax,
      totalTaxableIncome,
    ),
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
  ltcgBrackets: TaxBracket[],
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
  brackets: TaxBracket[],
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

/**
 * Taxable interest (1099-INT box 1), ignoring negative entries.
 */
export function taxableInterest(
  inputs: Pick<TaxInputs, "interestIncome">,
): number {
  return Math.max(0, inputs.interestIncome ?? 0);
}

/**
 * Interest that states may tax. Interest on U.S. Treasury obligations is
 * taxable federally but exempt from state income tax (31 U.S.C. 3124), so the
 * Treasury portion is removed; any excess over total interest is ignored.
 */
export function stateTaxableInterest(
  inputs: Pick<TaxInputs, "interestIncome" | "treasuryInterest">,
): number {
  const interest = taxableInterest(inputs);
  return (
    interest - Math.min(interest, Math.max(0, inputs.treasuryInterest ?? 0))
  );
}

/**
 * Split dividends into the portion taxed at ordinary rates and the portion
 * taxed at long-term capital gains rates. Qualified dividends are a subset of
 * ordinary dividends (1099-DIV box 1b is included in box 1a), so any excess
 * over the ordinary total is ignored.
 */
export function splitDividends(
  inputs: Pick<TaxInputs, "ordinaryDividends" | "qualifiedDividends">,
): { ordinary: number; qualified: number; nonQualified: number } {
  const ordinary = Math.max(0, inputs.ordinaryDividends ?? 0);
  const qualified = Math.min(
    ordinary,
    Math.max(0, inputs.qualifiedDividends ?? 0),
  );
  return { ordinary, qualified, nonQualified: ordinary - qualified };
}

/**
 * Net capital gains and losses the way Schedule D does.
 *
 * 1. Current year losses and prior year carryovers offset gains of the same
 *    term first (Schedule D lines 7 and 15).
 * 2. A net loss in one term then offsets a net gain in the other (line 16).
 * 3. Any remaining net loss is deductible against other income up to the
 *    annual limit ($3,000, or $1,500 married filing separately), short-term
 *    losses first (line 21 and the Capital Loss Carryover Worksheet).
 * 4. Whatever is left carries over to next year, keeping its term.
 *
 * Losses never offset dividends beyond the annual limit.
 *
 * Approximation: the annual deduction is capped by `otherIncome` (income
 * before deductions). The Capital Loss Carryover Worksheet instead counts the
 * deduction as used only up to taxable income before the deduction. When
 * other income is within the annual limit of total deductions (for a single
 * filer, below roughly the standard deduction plus $3,000), the carryover
 * reported here can be up to the annual limit too low. Tax for the current
 * year is unaffected.
 */
export function netCapitalGains(
  inputs: Pick<
    TaxInputs,
    | "longTermCapitalGains"
    | "priorYearLongTermLossCarryover"
    | "priorYearShortTermLossCarryover"
    | "shortTermCapitalGains"
  >,
  filingStatus: FilingStatus,
  sharedLimits: SharedLimitsData,
  otherIncome: number,
): CapitalGainsNetting {
  const shortTermGains = Math.max(0, inputs.shortTermCapitalGains);
  const longTermGains = Math.max(0, inputs.longTermCapitalGains);
  const shortTermLosses =
    Math.max(0, -inputs.shortTermCapitalGains) +
    Math.max(0, inputs.priorYearShortTermLossCarryover);
  const longTermLosses =
    Math.max(0, -inputs.longTermCapitalGains) +
    Math.max(0, inputs.priorYearLongTermLossCarryover);

  // Same-term netting
  const shortOnShort = Math.min(shortTermLosses, shortTermGains);
  const longOnLong = Math.min(longTermLosses, longTermGains);

  // Cross-term netting (at most one of these is non-zero)
  const shortOnLong = Math.min(
    shortTermLosses - shortOnShort,
    longTermGains - longOnLong,
  );
  const longOnShort = Math.min(
    longTermLosses - longOnLong,
    shortTermGains - shortOnShort,
  );

  // Deduction against other income, short-term losses first
  const annualLimit =
    filingStatus === "marriedFilingSeparately"
      ? sharedLimits.capitalLossLimit.marriedFilingSeparately
      : sharedLimits.capitalLossLimit.default;
  const deductionLimit = Math.min(annualLimit, Math.max(0, otherIncome));
  const shortDeduction = Math.min(
    shortTermLosses - shortOnShort - shortOnLong,
    deductionLimit,
  );
  const longDeduction = Math.min(
    longTermLosses - longOnLong - longOnShort,
    deductionLimit - shortDeduction,
  );

  const shortTermLossOffset = shortOnShort + shortOnLong + shortDeduction;
  const longTermLossOffset = longOnLong + longOnShort + longDeduction;

  return {
    longTermGains,
    longTermLossOffset,
    longTermLossUnused: longTermLosses - longTermLossOffset,
    netLongTermGain: longTermGains - longOnLong - shortOnLong,
    netShortTermGain: shortTermGains - shortOnShort - longOnShort,
    ordinaryIncomeDeduction: shortDeduction + longDeduction,
    shortTermGains,
    shortTermLossOffset,
    shortTermLossUnused: shortTermLosses - shortTermLossOffset,
  };
}
