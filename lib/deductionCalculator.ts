import {
  FilingStatus,
  DeductionBreakdown,
  FederalLimitsData,
  CaliforniaLimitsData,
  DeductionsData,
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

  // Calculate itemized deductions
  const itemizedDeduction =
    saltDeduction + deductibleMortgageInterest + inputs.charitableContributions;

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
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
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

// New York does NOT allow SALT deduction (can't deduct state tax from state tax)
// NY follows federal mortgage interest limits
export function calculateNewYorkDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  newYorkDeductions: DeductionsData,
  federalLimits: FederalLimitsData,
): DeductionBreakdown {
  const standardDeduction = newYorkDeductions.standardDeduction[filingStatus];

  // NY follows federal mortgage balance limits
  const mortgageBalanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? federalLimits.mortgageBalanceLimit.marriedFilingSeparately
      : federalLimits.mortgageBalanceLimit.default;

  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    mortgageBalanceLimit,
  );

  // New York itemized deductions (no SALT)
  const itemizedDeduction =
    deductibleMortgageInterest + inputs.charitableContributions;

  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // NY doesn't allow SALT
    saltCapped: false,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
  };
}

// DC does NOT allow SALT deduction (can't deduct DC tax from DC tax)
// DC follows federal mortgage interest limits
export function calculateDCDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  dcDeductions: DeductionsData,
  federalLimits: FederalLimitsData,
): DeductionBreakdown {
  const standardDeduction = dcDeductions.standardDeduction[filingStatus];

  // DC follows federal mortgage balance limits
  const mortgageBalanceLimit =
    filingStatus === "marriedFilingSeparately"
      ? federalLimits.mortgageBalanceLimit.marriedFilingSeparately
      : federalLimits.mortgageBalanceLimit.default;

  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    mortgageBalanceLimit,
  );

  // DC itemized deductions (no SALT)
  const itemizedDeduction =
    deductibleMortgageInterest + inputs.charitableContributions;

  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? "itemized" : "standard",
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // DC doesn't allow SALT
    saltCapped: false,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
  };
}
