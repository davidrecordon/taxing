export type FilingStatus = 'single' | 'marriedFilingJointly' | 'marriedFilingSeparately';

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface TaxBrackets {
  single: TaxBracket[];
  marriedFilingJointly: TaxBracket[];
  marriedFilingSeparately: TaxBracket[];
}

export interface TaxBracketsData {
  year: number;
  brackets: TaxBrackets;
}

export interface StandardDeductions {
  single: number;
  marriedFilingJointly: number;
  marriedFilingSeparately: number;
}

export interface DeductionsData {
  year: number;
  standardDeduction: StandardDeductions;
}

export interface LimitsData {
  year: number;
  saltLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  contribution401k: {
    standard: number;
    catchUp50Plus: number;
  };
  mortgageBalanceLimit: {
    federal: {
      default: number;
      marriedFilingSeparately: number;
    };
    california: number;
  };
}

export interface FicaData {
  year: number;
  socialSecurity: {
    rate: number;
    wageBaseCap: number;
  };
  medicareAdditional: {
    rate: number;
    thresholds: {
      single: number;
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
    };
  };
  medicareBase: {
    rate: number;
  };
}

// User Input Types
export interface TaxInputs {
  // Income fields
  federalIncome: number;
  californiaIncome: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;

  // Withholding and estimated payments
  federalTaxWithheld: number;
  californiaTaxWithheld: number;
  federalEstimatedPaid: number;
  californiaEstimatedPaid: number;

  // Filing status
  filingStatus: FilingStatus;

  // Deductions
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  charitableContributions: number;
  contributions401k: number;

  // Prior year
  priorYearFederalTaxPaid: number;
  priorYearCaliforniaTaxPaid: number;
  priorYearShortTermLossCarryover: number;
  priorYearLongTermLossCarryover: number;
}

// Calculation Result Types
export interface BracketBreakdown {
  bracketMin: number;
  bracketMax: number | null;
  rate: number;
  incomeInBracket: number;
  taxForBracket: number;
}

export interface DeductionBreakdown {
  standardDeduction: number;
  itemizedDeduction: number;
  deductionUsed: 'standard' | 'itemized';
  deductionAmount: number;
  saltDeduction: number;
  saltCapped: boolean;
  mortgageInterest: number;
  charitableContributions: number;
}

export interface FicaBreakdown {
  socialSecurityTax: number;
  socialSecurityWages: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalFica: number;
}

export interface SafeHarbor {
  currentYear90Percent: number;
  priorYear110Percent: number;
  minimum: number;
  met: boolean;
  remaining: number;
  highIncomeException?: boolean;  // CA only - AGI over threshold
}

export interface TaxCalculationResult {
  // Income breakdown
  wageIncome: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  grossIncome: number;
  shortTermLossCarryoverOffset: number;
  longTermLossCarryoverOffset: number;
  contributions401k: number;
  adjustedGrossIncome: number;

  // Deduction details
  deductionBreakdown: DeductionBreakdown;

  // Taxable income
  taxableOrdinaryIncome: number;
  taxableLTCG: number;

  // Tax by bracket
  ordinaryIncomeBracketBreakdown: BracketBreakdown[];
  ltcgBracketBreakdown: BracketBreakdown[];

  // Tax totals
  ordinaryIncomeTax: number;
  ltcgTax: number;
  ficaBreakdown?: FicaBreakdown;
  totalTax: number;

  // Payments already made
  withheld: number;
  estimatedPaid: number;
  totalPaid: number;

  // Final result
  remainingOwed: number;
  refundDue: number;

  // Safe harbor (federal only)
  safeHarbor?: SafeHarbor;
}

export interface CalculationResults {
  federal: TaxCalculationResult;
  california: TaxCalculationResult;
}
