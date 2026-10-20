import {
  FilingStatus,
  DeductionBreakdown,
  FederalLimitsData,
  CaliforniaLimitsData,
  DCLimitsData,
  DeductionsData,
  NewYorkLimitsData,
} from "./types";

interface DeductionInputs {
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  charitableContributions: number;
  stateTaxWithheld: number;
  stateEstimatedPaid: number;
}

function calculateDeductibleMortgageInterest(
  interestPaid: number,
  balance: number,
  balanceLimit: number,
): number {
  // If no balance entered, assume 100% is deductible
  if (balance <= 0) return interestPaid;

  // If balance is within limit, 100% is deductible
  if (balance <= balanceLimit) return interestPaid;

  // Otherwise, only the proportion within the limit is deductible
  return (balanceLimit / balance) * interestPaid;
}

/**
 * Federal SALT deduction cap for the year. The cap is reduced by a percentage
 * of modified AGI over the threshold, but never below the floor. Married
 * filing separately uses half the threshold, then half of the resulting cap
 * (Schedule A State and Local Tax Deduction Worksheet).
 */
export function calculateSaltLimit(
  filingStatus: FilingStatus,
  federalLimits: FederalLimitsData,
  agi: number,
): number {
  const { floor, limit, phasedownRate, phasedownThreshold } =
    federalLimits.saltLimit;
  const isSeparate = filingStatus === "marriedFilingSeparately";
  const threshold = isSeparate
    ? phasedownThreshold.marriedFilingSeparately
    : phasedownThreshold.default;

  const reduction = Math.max(0, agi - threshold) * phasedownRate;
  const cap = Math.max(floor, limit - reduction);
  return isSeparate ? cap / 2 : cap;
}

export function calculateFederalDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  federalDeductions: DeductionsData,
  federalLimits: FederalLimitsData,
  agi: number,
): DeductionBreakdown {
  const standardDeduction = federalDeductions.standardDeduction[filingStatus];

  // Calculate SALT (State and Local Taxes)
  const totalStateAndLocalTaxes =
    inputs.stateTaxWithheld +
    inputs.stateEstimatedPaid +
    inputs.propertyTaxesPaid;

  // SALT cap phases down as AGI rises above the threshold
  const saltLimit = calculateSaltLimit(filingStatus, federalLimits, agi);

  const saltDeduction = Math.min(totalStateAndLocalTaxes, saltLimit);
  const saltCapped = totalStateAndLocalTaxes > saltLimit;

  // Calculate deductible mortgage interest (limited by balance)
  const mortgageBalanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? federalLimits.mortgageBalanceLimit.marriedFilingSeparately
      : federalLimits.mortgageBalanceLimit.default;

  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    mortgageBalanceLimit,
  );

  // Charitable contributions count only above a share of AGI (2026 onward)
  const charitableFloorReduction = Math.min(
    inputs.charitableContributions,
    Math.max(0, agi) * federalLimits.charitableFloorRate,
  );
  const charitableContributions =
    inputs.charitableContributions - charitableFloorReduction;

  // Calculate itemized deductions (before the overall limitation)
  const itemizedDeduction =
    saltDeduction + deductibleMortgageInterest + charitableContributions;

  // Use whichever is higher
  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: useItemized ? saltDeduction : 0,
    saltCapped: useItemized && saltCapped,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? charitableContributions : 0,
    charitableFloorReduction: useItemized ? charitableFloorReduction : 0,
  };
}

/**
 * Overall limitation on federal itemized deductions (IRC 68, 2026 onward).
 * Deductions are reduced by a fraction of the lesser of the deductions or the
 * income above the start of the top bracket, after every other limit. If the
 * reduced amount no longer beats the standard deduction, the standard
 * deduction is used.
 *
 * `incomeBeforeItemized` is taxable income with itemized deductions added
 * back: AGI less the QBI deduction.
 */
export function applyFederalItemizedLimit(
  breakdown: DeductionBreakdown,
  incomeBeforeItemized: number,
  topBracketStart: number,
  federalLimits: FederalLimitsData,
): DeductionBreakdown {
  const { denominator, numerator } = federalLimits.itemizedDeductionReduction;
  if (breakdown.deductionUsed !== "itemized" || numerator === 0) {
    return breakdown;
  }

  const highIncomeReduction =
    (Math.min(
      breakdown.itemizedDeduction,
      Math.max(0, incomeBeforeItemized - topBracketStart),
    ) *
      numerator) /
    denominator;
  if (highIncomeReduction <= 0) return breakdown;

  const itemizedDeduction = breakdown.itemizedDeduction - highIncomeReduction;
  if (itemizedDeduction > breakdown.standardDeduction) {
    return {
      ...breakdown,
      itemizedDeduction,
      deductionAmount: itemizedDeduction,
      highIncomeReduction,
    };
  }

  return {
    ...breakdown,
    itemizedDeduction,
    deductionUsed: "standard",
    deductionAmount: breakdown.standardDeduction,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
    charitableFloorReduction: 0,
  };
}

/**
 * Reduce itemized deductions by a percentage of AGI over a threshold, up to a
 * maximum share of the deductions. Returns the amount of the reduction.
 */
function calculateHighIncomeReduction(
  itemizedDeductions: number,
  agi: number,
  threshold: number,
  rate: number,
  maxReductionRate: number,
): number {
  return Math.min(
    Math.max(0, agi - threshold) * rate,
    itemizedDeductions * maxReductionRate,
  );
}

// California allows property tax in full (no SALT cap) but not state income
// tax, and reduces itemized deductions for high incomes. It does not follow
// the 2025 federal law changes (charitable floor, 35% cap).
export function calculateCaliforniaDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  californiaDeductions: DeductionsData,
  californiaLimits: CaliforniaLimitsData,
  agi: number,
): DeductionBreakdown {
  const standardDeduction =
    californiaDeductions.standardDeduction[filingStatus];

  // Calculate deductible mortgage interest (CA limit is $1M, $500k MFS)
  const mortgageBalanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? californiaLimits.mortgageBalanceLimit.marriedFilingSeparately
      : californiaLimits.mortgageBalanceLimit.default;
  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    mortgageBalanceLimit,
  );

  const beforeLimit =
    inputs.propertyTaxesPaid +
    deductibleMortgageInterest +
    inputs.charitableContributions;

  // High-income limitation (Schedule CA Itemized Deductions Worksheet)
  const limit = californiaLimits.itemizedDeductionLimit;
  const highIncomeReduction = calculateHighIncomeReduction(
    beforeLimit,
    agi,
    limit.threshold[filingStatus],
    limit.rate,
    limit.maxReductionRate,
  );
  const itemizedDeduction = beforeLimit - highIncomeReduction;

  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // State income tax is not deductible
    saltCapped: false,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
    propertyTax: useItemized ? inputs.propertyTaxesPaid : 0,
    highIncomeReduction: useItemized ? highIncomeReduction : 0,
  };
}

// New York itemized deductions follow the federal rules as they stood before
// 2018: property tax is deductible in full (no SALT cap), state income tax is
// not, and the mortgage limit is $1M ($500k MFS). Higher incomes lose part of
// the total under the New York itemized deduction adjustment. New York does
// not follow the 2025 federal law changes.
export function calculateNewYorkDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  newYorkDeductions: DeductionsData,
  newYorkLimits: NewYorkLimitsData,
  agi: number,
): DeductionBreakdown {
  const standardDeduction = newYorkDeductions.standardDeduction[filingStatus];

  const mortgageBalanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? newYorkLimits.mortgageBalanceLimit.marriedFilingSeparately
      : newYorkLimits.mortgageBalanceLimit.default;
  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    mortgageBalanceLimit,
  );

  const beforeLimit =
    inputs.propertyTaxesPaid +
    deductibleMortgageInterest +
    inputs.charitableContributions;

  const itemizedDeduction = applyNewYorkItemizedAdjustment(
    beforeLimit,
    inputs.charitableContributions,
    filingStatus,
    newYorkLimits,
    agi,
  );

  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // State income tax is not deductible
    saltCapped: false,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
    propertyTax: useItemized ? inputs.propertyTaxesPaid : 0,
    highIncomeReduction: useItemized ? beforeLimit - itemizedDeduction : 0,
  };
}

// The worksheets round each phase-in ratio to four decimal places
function roundToFourDecimals(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * New York itemized deduction adjustment (Form IT-196 lines 46-47 and
 * Worksheets 3 and 4). Returns the deduction allowed after the adjustment.
 */
function applyNewYorkItemizedAdjustment(
  itemizedDeductions: number,
  charitableContributions: number,
  filingStatus: FilingStatus,
  newYorkLimits: NewYorkLimitsData,
  agi: number,
): number {
  const adjustment = newYorkLimits.itemizedDeductionAdjustment;

  // Above $1M only a share of charitable contributions is allowed
  if (agi > adjustment.charitableOnlyHighThreshold) {
    return charitableContributions * adjustment.charitableOnlyHighRate;
  }
  if (agi > adjustment.charitableOnlyThreshold) {
    return charitableContributions * adjustment.charitableOnlyRate;
  }

  const phaseIn = (start: number) =>
    roundToFourDecimals(
      Math.min(Math.max(0, agi - start), adjustment.phaseInRange) /
        adjustment.phaseInRange,
    );
  const reductionRate =
    adjustment.rate * phaseIn(adjustment.base[filingStatus]) +
    adjustment.rate * phaseIn(adjustment.secondTierThreshold);

  return itemizedDeductions * (1 - reductionRate);
}

// DC starts from the federal itemized deductions, removes state income tax,
// allows property tax in full (no SALT cap), and reduces the result for high
// incomes (D-40 Calculation F). The taxpayer must take the same type of
// deduction as on the federal return, so pass the federal breakdown whenever
// it is available; without it the larger deduction is used.
export function calculateDCDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  dcDeductions: DeductionsData,
  federalLimits: FederalLimitsData,
  dcLimits: DCLimitsData,
  agi: number,
  federalDeduction?: DeductionBreakdown,
): DeductionBreakdown {
  const standardDeduction = dcDeductions.standardDeduction[filingStatus];
  const federalItemized = federalDeduction?.deductionUsed === "itemized";

  // DC follows the federal mortgage interest and charitable amounts
  const mortgageBalanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? federalLimits.mortgageBalanceLimit.marriedFilingSeparately
      : federalLimits.mortgageBalanceLimit.default;
  const deductibleMortgageInterest = federalItemized
    ? federalDeduction.mortgageInterest
    : calculateDeductibleMortgageInterest(
        inputs.mortgageInterestPaid,
        inputs.mortgageBalance,
        mortgageBalanceLimit,
      );
  const charitableContributions = federalItemized
    ? federalDeduction.charitableContributions
    : inputs.charitableContributions;

  const beforeLimit =
    inputs.propertyTaxesPaid +
    deductibleMortgageInterest +
    charitableContributions;

  // High-income limitation: 5% of DC AGI over the threshold, with no cap
  const limit = dcLimits.itemizedDeductionLimit;
  const highIncomeReduction = calculateHighIncomeReduction(
    beforeLimit,
    agi,
    filingStatus === "marriedFilingSeparately"
      ? limit.threshold.marriedFilingSeparately
      : limit.threshold.default,
    limit.rate,
    1,
  );
  const itemizedDeduction = beforeLimit - highIncomeReduction;

  const useItemized = federalDeduction
    ? federalItemized
    : itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // State income tax is not deductible
    saltCapped: false,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? charitableContributions : 0,
    propertyTax: useItemized ? inputs.propertyTaxesPaid : 0,
    highIncomeReduction: useItemized ? highIncomeReduction : 0,
    followsFederalChoice: federalDeduction !== undefined,
  };
}
