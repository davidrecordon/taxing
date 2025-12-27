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
  brackets: TaxBrackets;
}

// Multi-year wrapper type for JSON files
export type MultiYearTaxBrackets = Record<string, TaxBracketsData>;

export interface StandardDeductions {
  single: number;
  marriedFilingJointly: number;
  marriedFilingSeparately: number;
}

export interface DeductionsData {
  standardDeduction: StandardDeductions;
}

// Multi-year wrapper type for JSON files
export type MultiYearDeductions = Record<string, DeductionsData>;

export interface LimitsData {
  saltLimit: {
    default: number;
    marriedFilingSeparately: number;
    elevated: {
      marriedFilingJointly: number;
      single: number;
      marriedFilingSeparately: number;
    };
    elevatedAgiThreshold: number;
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
  capitalLossLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  caMentalHealthTax: {
    threshold: number;
    thresholdMFS: number;
    rate: number;
  };
  safeHarbor: {
    currentYearPercent: number;
    federalPriorYearPercent: number;
    californiaPriorYearPercent: number;
  };
}

// Multi-year wrapper type for JSON files
export type MultiYearLimits = Record<string, LimitsData>;

export interface FicaData {
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

// Multi-year wrapper type for JSON files
export type MultiYearFica = Record<string, FicaData>;

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
  priorYearSafeHarbor: number;
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
  longTermLossCarryoverUnused?: number;  // Preserved for future years (0% bracket optimization)
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
  caMentalHealthTax?: number;  // California only - 1% on income over $1M
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
