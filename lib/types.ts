export type FilingStatus = 'single' | 'marriedFilingJointly' | 'marriedFilingSeparately';

export type TaxState = 'california' | 'washington' | 'newyork';

export const STATE_LABELS: Record<TaxState, string> = {
  california: 'California',
  washington: 'Washington',
  newyork: 'New York',
};

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

// Shared cross-cutting limits (applies to all jurisdictions)
export interface SharedLimitsData {
  contribution401k: {
    standard: number;
    catchUp50Plus: number;
  };
  capitalLossLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
}

// Federal-specific limits
export interface FederalLimitsData {
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
  mortgageBalanceLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  safeHarbor: {
    currentYearPercent: number;
    priorYearPercent: number;
  };
}

// California-specific limits
export interface CaliforniaLimitsData {
  mortgageBalanceLimit: number;
  mentalHealthTax: {
    threshold: number;
    thresholdMFS: number;
    rate: number;
  };
  safeHarbor: {
    currentYearPercent: number;
    priorYearPercent: number;
  };
}

// Washington-specific limits
export interface WashingtonLimitsData {
  exemption: number;
  surtaxThreshold: number;
  baseRate: number;
  surtaxRate: number;
  safeHarbor: {
    percent: number;
  };
}

// New York-specific limits
export interface NewYorkLimitsData {
  safeHarbor: {
    currentYearPercent: number;
    priorYearPercent: number;
    highIncomeThreshold: number;
    highIncomeThresholdMFS: number;
    highIncomePercent: number;
  };
}

// Multi-year wrapper types for JSON files
export type MultiYearSharedLimits = Record<string, SharedLimitsData>;
export type MultiYearFederalLimits = Record<string, FederalLimitsData>;
export type MultiYearCaliforniaLimits = Record<string, CaliforniaLimitsData>;
export type MultiYearWashingtonLimits = Record<string, WashingtonLimitsData>;
export type MultiYearNewYorkLimits = Record<string, NewYorkLimitsData>;

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
  stateIncome: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;

  // Withholding and estimated payments
  federalTaxWithheld: number;
  stateTaxWithheld: number;
  federalEstimatedPaid: number;
  stateEstimatedPaid: number;

  // Filing status and state selection
  filingStatus: FilingStatus;
  selectedState: TaxState;
  isNYCResident?: boolean;

  // Deductions
  propertyTaxesPaid: number;
  mortgageInterestPaid: number;
  mortgageBalance: number;
  charitableContributions: number;
  contributions401k: number;

  // Prior year
  priorYearFederalTaxPaid: number;
  priorYearStateTaxPaid: number;
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
  isHighIncome?: boolean;  // NY - whether 110% rule applies
}

export interface TaxCalculationResult {
  // Income breakdown
  wageIncome: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  grossIncome: number;
  shortTermLossCarryoverOffset: number;
  shortTermLossCarryoverUnused?: number;  // Preserved for future years
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
  nycTax?: number;  // New York City local tax
  nycBracketBreakdown?: BracketBreakdown[];  // NYC tax bracket breakdown
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
  state: TaxCalculationResult;
  selectedState: TaxState;
}
