import { FilingStatus, DeductionBreakdown, LimitsData, DeductionsData } from './types';

interface DeductionInputs {
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  charitableContributions: number;
  californiaTaxWithheld: number;
  californiaEstimatedPaid: number;
}

function calculateDeductibleMortgageInterest(
  interestPaid: number,
  balance: number,
  balanceLimit: number
): number {
  // If no balance entered, assume 100% is deductible
  if (balance <= 0) return interestPaid;

  // If balance is within limit, 100% is deductible
  if (balance <= balanceLimit) return interestPaid;

  // Otherwise, only the proportion within the limit is deductible
  return (balanceLimit / balance) * interestPaid;
}

export function calculateFederalDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  federalDeductions: DeductionsData,
  limits: LimitsData
): DeductionBreakdown {
  const standardDeduction = federalDeductions.standardDeduction[filingStatus];

  // Calculate SALT (State and Local Taxes)
  const totalStateAndLocalTaxes =
    inputs.californiaTaxWithheld +
    inputs.californiaEstimatedPaid +
    inputs.propertyTaxesPaid;

  const saltLimit =
    filingStatus === 'marriedFilingSeparately'
      ? limits.saltLimit.marriedFilingSeparately
      : limits.saltLimit.default;

  const saltDeduction = Math.min(totalStateAndLocalTaxes, saltLimit);
  const saltCapped = totalStateAndLocalTaxes > saltLimit;

  // Calculate deductible mortgage interest (limited by balance)
  const mortgageBalanceLimit =
    filingStatus === 'marriedFilingSeparately'
      ? limits.mortgageBalanceLimit.federal.marriedFilingSeparately
      : limits.mortgageBalanceLimit.federal.default;

  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    mortgageBalanceLimit
  );

  // Calculate itemized deductions
  const itemizedDeduction =
    saltDeduction + deductibleMortgageInterest + inputs.charitableContributions;

  // Use whichever is higher
  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? 'itemized' : 'standard',
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: useItemized ? saltDeduction : 0,
    saltCapped: useItemized && saltCapped,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
  };
}

// California does NOT allow SALT deduction
export function calculateCaliforniaDeductions(
  inputs: DeductionInputs,
  filingStatus: FilingStatus,
  californiaDeductions: DeductionsData,
  limits: LimitsData
): DeductionBreakdown {
  const standardDeduction = californiaDeductions.standardDeduction[filingStatus];

  // Calculate deductible mortgage interest (CA limit is $1M for all filing statuses)
  const deductibleMortgageInterest = calculateDeductibleMortgageInterest(
    inputs.mortgageInterestPaid,
    inputs.mortgageBalance,
    limits.mortgageBalanceLimit.california
  );

  // California itemized deductions (no SALT)
  const itemizedDeduction =
    deductibleMortgageInterest + inputs.charitableContributions;

  const useItemized = itemizedDeduction > standardDeduction;

  return {
    standardDeduction,
    itemizedDeduction,
    deductionUsed: useItemized ? 'itemized' : 'standard',
    deductionAmount: useItemized ? itemizedDeduction : standardDeduction,
    saltDeduction: 0, // CA doesn't allow SALT
    saltCapped: false,
    mortgageInterest: useItemized ? deductibleMortgageInterest : 0,
    charitableContributions: useItemized ? inputs.charitableContributions : 0,
  };
}
