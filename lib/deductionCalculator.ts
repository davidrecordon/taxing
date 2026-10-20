import {
  FilingStatus,
  DeductionBreakdown,
  FederalLimitsData,
  CaliforniaLimitsData,
  DCLimitsData,
  DeductionChoice,
  DeductionsData,
  NewYorkLimitsData,
} from "./types";

interface DeductionInputs {
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  isMortgageGrandfathered?: boolean;
  charitableContributions: number;
  stateTaxWithheld: number;
  stateEstimatedPaid: number;
  priorYearStateBalancePaid?: number;
}

interface MortgageBalanceLimit {
  default: number;
  marriedFilingSeparately: number;
}

// Mortgage interest is deductible in proportion to the balance within the
// jurisdiction's limit
function calculateDeductibleMortgageInterest(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  limit: MortgageBalanceLimit,
): number {
  const { mortgageBalance: balance, mortgageInterestPaid: interestPaid } =
    inputs;
  const balanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? limit.marriedFilingSeparately
      : limit.default;

  // If no balance entered, assume 100% is deductible
  if (balance <= 0) return interestPaid;

  // If balance is within limit, 100% is deductible
  if (balance <= balanceLimit) return interestPaid;

  // Otherwise, only the proportion within the limit is deductible
  return (balanceLimit / balance) * interestPaid;
}

// Loans taken out on or before December 15, 2017 keep the older, higher
// federal limit
function federalMortgageBalanceLimit(
  inputs: DeductionInputs,
  federalLimits: FederalLimitsData,
): MortgageBalanceLimit {
  return inputs.isMortgageGrandfathered
    ? federalLimits.grandfatheredMortgageBalanceLimit
    : federalLimits.mortgageBalanceLimit;
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
  deductionChoice?: DeductionChoice,
): DeductionBreakdown {
  const standardDeduction = federalDeductions.standardDeduction[filingStatus];

  // Calculate SALT (State and Local Taxes)
  // State income tax counts in the year it is paid, including a balance paid
  // this year with last year's return
  const totalStateAndLocalTaxes =
    inputs.stateTaxWithheld +
    inputs.stateEstimatedPaid +
    (inputs.priorYearStateBalancePaid ?? 0) +
    inputs.propertyTaxesPaid;

  // SALT cap phases down as AGI rises above the threshold
  const saltLimit = calculateSaltLimit(filingStatus, federalLimits, agi);

  const saltDeduction = Math.min(totalStateAndLocalTaxes, saltLimit);
  const saltCapped = totalStateAndLocalTaxes > saltLimit;

  // Calculate deductible mortgage interest (limited by balance)
  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs,
    filingStatus,
    federalMortgageBalanceLimit(inputs, federalLimits),
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

  // Use whichever is higher, unless the choice is made for the taxpayer (a
  // filer may itemize even when the standard deduction is larger)
  const useItemized = deductionChoice
    ? deductionChoice === "itemized"
    : itemizedDeduction > standardDeduction;

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
 * deduction is used, unless itemizing was chosen regardless.
 *
 * `incomeBeforeItemized` is taxable income with itemized deductions added
 * back: AGI less the QBI deduction.
 */
export function applyFederalItemizedLimit(
  breakdown: DeductionBreakdown,
  incomeBeforeItemized: number,
  topBracketStart: number,
  federalLimits: FederalLimitsData,
  deductionChoice?: DeductionChoice,
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
  if (
    deductionChoice === "itemized" ||
    itemizedDeduction > breakdown.standardDeduction
  ) {
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

interface StateItemizedComponents {
  charitableContributions: number;
  mortgageInterest: number;
  propertyTax: number;
}

/**
 * Build the deduction breakdown for a state return, where property tax is
 * deductible outside any SALT cap and state income tax is not deductible.
 * `itemizedDeduction` is the amount left after the state's income-based
 * limitation.
 */
function buildStateDeductionBreakdown(
  standardDeduction: number,
  components: StateItemizedComponents,
  itemizedDeduction: number,
  useItemized: boolean,
  followsFederalChoice?: boolean,
): DeductionBreakdown {
  const beforeLimit =
    components.propertyTax +
    components.mortgageInterest +
    components.charitableContributions;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // State income tax is not deductible
    saltCapped: false,
    mortgageInterest: useItemized ? components.mortgageInterest : 0,
    charitableContributions: useItemized
      ? components.charitableContributions
      : 0,
    propertyTax: useItemized ? components.propertyTax : 0,
    highIncomeReduction: useItemized ? beforeLimit - itemizedDeduction : 0,
    ...(followsFederalChoice === undefined ? {} : { followsFederalChoice }),
  };
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

  // CA mortgage limit is $1M ($500k MFS)
  const components = {
    charitableContributions: inputs.charitableContributions,
    mortgageInterest: calculateDeductibleMortgageInterest(
      inputs,
      filingStatus,
      californiaLimits.mortgageBalanceLimit,
    ),
    propertyTax: inputs.propertyTaxesPaid,
  };
  const beforeLimit =
    components.propertyTax +
    components.mortgageInterest +
    components.charitableContributions;

  // High-income limitation (Schedule CA Itemized Deductions Worksheet): 6% of
  // AGI over the threshold, up to 80% of the deductions
  const limit = californiaLimits.itemizedDeductionLimit;
  const itemizedDeduction =
    beforeLimit -
    Math.min(
      Math.max(0, agi - limit.threshold[filingStatus]) * limit.rate,
      beforeLimit * limit.maxReductionRate,
    );

  return buildStateDeductionBreakdown(
    standardDeduction,
    components,
    itemizedDeduction,
    itemizedDeduction > standardDeduction,
  );
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

  const components = {
    charitableContributions: inputs.charitableContributions,
    mortgageInterest: calculateDeductibleMortgageInterest(
      inputs,
      filingStatus,
      newYorkLimits.mortgageBalanceLimit,
    ),
    propertyTax: inputs.propertyTaxesPaid,
  };

  const itemizedDeduction = applyNewYorkItemizedAdjustment(
    components.propertyTax +
      components.mortgageInterest +
      components.charitableContributions,
    components.charitableContributions,
    filingStatus,
    newYorkLimits,
    agi,
  );

  return buildStateDeductionBreakdown(
    standardDeduction,
    components,
    itemizedDeduction,
    itemizedDeduction > standardDeduction,
  );
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
  const components = {
    charitableContributions: federalItemized
      ? federalDeduction.charitableContributions
      : inputs.charitableContributions,
    mortgageInterest: federalItemized
      ? federalDeduction.mortgageInterest
      : calculateDeductibleMortgageInterest(
          inputs,
          filingStatus,
          federalMortgageBalanceLimit(inputs, federalLimits),
        ),
    propertyTax: inputs.propertyTaxesPaid,
  };
  const beforeLimit =
    components.propertyTax +
    components.mortgageInterest +
    components.charitableContributions;

  // High-income limitation: 5% of DC AGI over the threshold, with no cap
  // other than the deductions themselves
  const limit = dcLimits.itemizedDeductionLimit;
  const threshold =
    filingStatus === "marriedFilingSeparately"
      ? limit.threshold.marriedFilingSeparately
      : limit.threshold.default;
  const itemizedDeduction = Math.max(
    0,
    beforeLimit - Math.max(0, agi - threshold) * limit.rate,
  );

  return buildStateDeductionBreakdown(
    standardDeduction,
    components,
    itemizedDeduction,
    federalDeduction ? federalItemized : itemizedDeduction > standardDeduction,
    federalDeduction !== undefined,
  );
}
