import { TaxYear } from "./config";

export type FilingStatus =
  | "single"
  | "marriedFilingJointly"
  | "marriedFilingSeparately";

export type TaxState =
  | "california"
  | "colorado"
  | "dc"
  | "florida"
  | "illinois"
  | "newyork"
  | "washington";

export const STATE_LABELS: Record<TaxState, string> = {
  california: "California",
  colorado: "Colorado",
  dc: "District of Columbia",
  florida: "Florida",
  illinois: "Illinois",
  newyork: "New York",
  washington: "Washington",
};

export interface TaxBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface TaxBrackets {
  marriedFilingJointly: TaxBracket[];
  marriedFilingSeparately: TaxBracket[];
  single: TaxBracket[];
}

export interface TaxBracketsData {
  brackets: TaxBrackets;
}

// Multi-year wrapper type for JSON files
export type MultiYearTaxBrackets = Record<string, TaxBracketsData>;

export interface StandardDeductions {
  marriedFilingJointly: number;
  marriedFilingSeparately: number;
  single: number;
}

export interface DeductionsData {
  standardDeduction: StandardDeductions;
}

// Multi-year wrapper type for JSON files
export type MultiYearDeductions = Record<string, DeductionsData>;

// Shared cross-cutting limits (applies to all jurisdictions)
export interface SharedLimitsData {
  capitalLossLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  contribution401k: {
    catchUp50Plus: number;
    standard: number;
  };
  // Prior-year income above which the higher prior-year safe harbor
  // percentage applies (shown in the form; the user states which side they
  // were on)
  priorYearHighIncomeThreshold: {
    default: number;
    marriedFilingSeparately: number;
  };
}

// Federal-specific limits
export interface FederalLimitsData {
  // Share of AGI below which charitable contributions are not deductible
  // for itemizers (0 before 2026)
  charitableFloorRate: number;
  // Mortgage limit for loans taken out on or before December 15, 2017
  grandfatheredMortgageBalanceLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  // Overall limitation on itemized deductions (IRC 68): the fraction applied
  // to the lesser of itemized deductions or income above the start of the top
  // bracket (numerator 0 before 2026)
  itemizedDeductionReduction: {
    denominator: number;
    numerator: number;
  };
  mortgageBalanceLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  niit: {
    rate: number;
    thresholds: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
  };
  qbiDeduction: {
    phaseoutRange: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
    rate: number;
    taxableIncomeThreshold: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
  };
  safeHarbor: {
    currentYearPercent: number;
    highIncomePriorYearPercent: number;
    priorYearPercent: number;
  };
  // SALT cap is reduced by phasedownRate for each dollar of MAGI over the
  // threshold, but never below the floor. Married filing separately gets half
  // of the resulting cap.
  saltLimit: {
    floor: number;
    limit: number;
    phasedownRate: number;
    phasedownThreshold: {
      default: number;
      marriedFilingSeparately: number;
    };
  };
  // Flat withholding on bonuses and stock: `rate` up to `highThreshold` of
  // supplemental wages in the year, `highRate` above it
  supplementalWithholding: {
    highRate: number;
    highThreshold: number;
    rate: number;
  };
}

// California-specific limits
export interface CaliforniaLimitsData {
  // Itemized deductions are reduced by `rate` of federal AGI over the
  // threshold, up to `maxReductionRate` of the deductions
  itemizedDeductionLimit: {
    maxReductionRate: number;
    rate: number;
    threshold: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
  };
  mentalHealthTax: {
    rate: number;
    threshold: number; // Taxable income; the same for every filing status
  };
  mortgageBalanceLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  safeHarbor: {
    currentYearPercent: number;
    highIncomePriorYearPercent: number;
    priorYearPercent: number;
    // At or above this current-year AGI the prior-year method is unavailable
    priorYearUnavailableAgi: {
      default: number;
      marriedFilingSeparately: number;
    };
  };
}

// EDD Method B exact calculation, annual payroll period: what a California
// employer withholds. Not the tax tables: the rates are 10% above the tax
// rates and the bracket edges and standard deduction are the prior year's.
export interface CaliforniaWithholdingData {
  allowanceCredit: number; // Table 4, per allowance per year
  // Allowances assumed for the estimate: none without a DE 4 (EDD's default);
  // two for a joint return, which is the married two-or-more column
  assumedAllowances: {
    marriedFilingJointly: number;
    marriedFilingSeparately: number;
    single: number;
  };
  brackets: {
    marriedFilingJointly: TaxBracket[];
    marriedFilingSeparately: TaxBracket[];
    single: TaxBracket[];
  };
  // Table 1: no withholding at or below this much in annual wages
  lowIncomeExemption: {
    marriedFilingJointly: number;
    marriedFilingSeparately: number;
    single: number;
  };
  standardDeduction: {
    // Table 3
    marriedFilingJointly: number;
    marriedFilingSeparately: number;
    single: number;
  };
  supplementalRate: number; // Flat rate on bonuses and stock
}

// DR 1098 worksheet, annualized: what a Colorado employer withholds. One rate
// on wages less a standard allowance by filing status, with no separate rule
// for bonuses and stock.
export interface ColoradoWithholdingData {
  rate: number;
  // Line 2a without a DR 0004: by the W-4 filing status, single when there is
  // no W-4 either
  standardAllowance: {
    marriedFilingJointly: number;
    marriedFilingSeparately: number;
    single: number;
  };
}

// Booklet IL-700-T automated payroll method: what an Illinois employer
// withholds. One rate on wages less the allowances claimed on the IL-W-4, with
// no separate rule for bonuses and stock.
export interface IllinoisWithholdingData {
  allowance: number; // Per IL-W-4 Line 1 allowance per year
  // Allowances assumed for the estimate: the IL-W-4 worksheet's one for the
  // employee and one more for a spouse on a joint return, none on Line 2
  assumedAllowances: {
    marriedFilingJointly: number;
    marriedFilingSeparately: number;
    single: number;
  };
  rate: number;
}

// Washington-specific limits
export interface WashingtonLimitsData {
  baseRate: number;
  exemption: number;
  safeHarbor: {
    percent: number;
  };
  surtaxRate: number;
  surtaxThreshold: number;
}

// New York-specific limits
// One upper tier of the New York tax benefit recapture: for taxable income
// above `minTaxableIncome`, add `recaptureBase` plus `incrementalBenefit`
// phased in over AGI above the same amount
export interface NewYorkRecaptureTier {
  incrementalBenefit: number;
  minTaxableIncome: number;
  recaptureBase: number;
}

export interface NewYorkLimitsData {
  // New York itemized deduction adjustment (Form IT-196 lines 46-47), based
  // on New York AGI. Each tier removes `rate` of the deductions, phased in over
  // `phaseInRange`: the first above `base`, the second above
  // `secondTierThreshold`. Above the charitable-only thresholds the deduction
  // is limited to a share of charitable contributions.
  itemizedDeductionAdjustment: {
    base: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
    charitableOnlyHighRate: number;
    charitableOnlyHighThreshold: number;
    charitableOnlyRate: number;
    charitableOnlyThreshold: number;
    phaseInRange: number;
    rate: number;
    secondTierThreshold: number;
  };
  mortgageBalanceLimit: {
    default: number;
    marriedFilingSeparately: number;
  };
  // New York City school tax credit (IT-201 lines 69 and 69a)
  nycSchoolTaxCredit: {
    fixedAmount: {
      default: number;
      marriedFilingJointly: number;
    };
    fixedAmountIncomeLimit: number;
    // `baseRate` of city taxable income up to the threshold; above it,
    // `baseAmount` plus `excessRate` of the excess
    rateReduction: {
      baseAmount: {
        default: number;
        marriedFilingJointly: number;
      };
      baseRate: number;
      excessRate: number;
      incomeLimit: number;
      threshold: {
        default: number;
        marriedFilingJointly: number;
      };
    };
  };
  safeHarbor: {
    currentYearPercent: number;
    highIncomePriorYearPercent: number;
    priorYearPercent: number;
  };
  // Tax benefit recapture (IT-201 tax computation worksheets): above the AGI
  // threshold the benefit of the lower brackets is phased out
  taxBenefitRecapture: {
    agiThreshold: number;
    // Flat rate the first tier phases toward, for taxable income up to the
    // first entry in `tiers`
    firstTierRate: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
    phaseInRange: number;
    tiers: {
      marriedFilingJointly: NewYorkRecaptureTier[];
      marriedFilingSeparately: NewYorkRecaptureTier[];
      single: NewYorkRecaptureTier[];
    };
    topRate: number; // Flat rate on all taxable income above topRateAgiThreshold
    topRateAgiThreshold: number;
  };
}

// Illinois-specific limits
export interface IllinoisLimitsData {
  // Federal AGI above which the personal exemption and the property tax
  // credit are not allowed
  incomeLimit: {
    default: number;
    marriedFilingJointly: number;
  };
  propertyTaxCreditRate: number;
  safeHarbor: {
    currentYearPercent: number;
    priorYearPercent: number;
  };
}

// Colorado-specific limits
export interface ColoradoLimitsData {
  // Non-itemizers subtract charitable contributions above this amount
  charitableSubtractionFloor: number;
  // At or above the AGI threshold, federal deductions above the limit are
  // added back
  deductionAddback: {
    agiThreshold: number;
    limit: {
      default: number;
      marriedFilingJointly: number;
    };
  };
  safeHarbor: {
    currentYearPercent: number;
    highIncomePriorYearPercent: number;
    priorYearPercent: number;
  };
}

// Florida-specific limits (no income tax state)
export interface FloridaLimitsData {
  safeHarbor: {
    percent: number;
  };
}

// DC-specific limits
export interface DCLimitsData {
  // Itemized deductions are reduced by `rate` of DC AGI over the threshold
  itemizedDeductionLimit: {
    rate: number;
    threshold: {
      default: number;
      marriedFilingSeparately: number;
    };
  };
  safeHarbor: {
    currentYearPercent: number;
    priorYearPercent: number;
  };
}

// Illinois personal exemptions (instead of standard deductions)
export interface IllinoisPersonalExemptions {
  marriedFilingJointly: number;
  marriedFilingSeparately: number;
  single: number;
}

export interface IllinoisDeductionsData {
  personalExemption: IllinoisPersonalExemptions;
}

// Multi-year wrapper types for JSON files
export type MultiYearSharedLimits = Record<string, SharedLimitsData>;
export type MultiYearFederalLimits = Record<string, FederalLimitsData>;
export type MultiYearCaliforniaLimits = Record<string, CaliforniaLimitsData>;
export type MultiYearWashingtonLimits = Record<string, WashingtonLimitsData>;
export type MultiYearNewYorkLimits = Record<string, NewYorkLimitsData>;
export type MultiYearIllinoisLimits = Record<string, IllinoisLimitsData>;
export type MultiYearIllinoisDeductions = Record<
  string,
  IllinoisDeductionsData
>;
export type MultiYearColoradoLimits = Record<string, ColoradoLimitsData>;
export type MultiYearDCLimits = Record<string, DCLimitsData>;
export type MultiYearFloridaLimits = Record<string, FloridaLimitsData>;

export interface FicaData {
  medicareAdditional: {
    rate: number;
    thresholds: {
      marriedFilingJointly: number;
      marriedFilingSeparately: number;
      single: number;
    };
  };
  medicareBase: {
    rate: number;
  };
  selfEmployment: {
    deductiblePortion: number;
    medicareRate: number;
    netEarningsRate: number;
    socialSecurityRate: number;
  };
  socialSecurity: {
    rate: number;
    wageBaseCap: number;
  };
}

// Multi-year wrapper type for JSON files
export type MultiYearFica = Record<string, FicaData>;

// User Input Types
export interface TaxInputs {
  // Tax year
  taxYear: TaxYear;

  // Income fields
  federalIncome: number;
  stateIncome: number;
  // The part of wages paid as bonuses or stock. Withheld on at flat rates, so
  // it only affects the withholding estimate, not the tax.
  supplementalWages: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  interestIncome: number; // 1099-INT box 1 (taxable interest)
  treasuryInterest: number; // Portion of interestIncome from U.S. Treasuries (exempt from state tax)
  ordinaryDividends: number; // 1099-DIV box 1a (total, includes qualified)
  qualifiedDividends: number; // 1099-DIV box 1b (subset of ordinary)

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
  isMortgageGrandfathered?: boolean; // Loan from on or before December 15, 2017
  charitableContributions: number;
  contributions401k: number;
  preTaxMedical: number;

  // Prior year
  priorYearFederalTax: number;
  priorYearStateTax: number;
  // State tax for last year that was paid this year with last year's return.
  // Deductible federally this year; not a payment toward this year's state tax.
  priorYearStateBalancePaid: number;
  // Whether last year's income was over the high-income threshold ($150,000,
  // $75,000 married filing separately). Treated as true when not set.
  priorYearIncomeOverThreshold?: boolean;
  priorYearShortTermLossCarryover: number;
  priorYearLongTermLossCarryover: number;
  selfEmploymentIncome: number;
}

// Calculation Result Types

// Result of Schedule D netting (see netCapitalGains in taxUtils.ts)
export interface CapitalGainsNetting {
  longTermGains: number; // Current year long-term gains (0 if a loss)
  longTermLossOffset: number; // Long-term losses used this year
  longTermLossUnused: number; // Long-term carryover to next year
  netLongTermGain: number; // Long-term gain left after netting
  netShortTermGain: number; // Short-term gain left after netting
  ordinaryIncomeDeduction: number; // Net loss deducted from other income
  shortTermGains: number; // Current year short-term gains (0 if a loss)
  shortTermLossOffset: number; // Short-term losses used this year
  shortTermLossUnused: number; // Short-term carryover to next year
}

export interface BracketBreakdown {
  bracketMin: number;
  bracketMax: number | null;
  rate: number;
  incomeInBracket: number;
  taxForBracket: number;
}

// Forces the standard or itemized deduction instead of taking the larger one
export type DeductionChoice = "standard" | "itemized";

export interface DeductionBreakdown {
  standardDeduction: number;
  itemizedDeduction: number;
  deductionUsed: "standard" | "itemized";
  deductionAmount: number;
  saltDeduction: number;
  saltCapped: boolean;
  mortgageInterest: number;
  charitableContributions: number;
  propertyTax?: number; // State returns: property tax deducted outside any SALT cap
  highIncomeReduction?: number; // Itemized deductions lost to a high-income limit
  followsFederalChoice?: boolean; // Standard vs itemized is set by the federal return
  chosenForStateTax?: boolean; // The smaller federal deduction was taken because it lowers federal and state tax combined (DC, Colorado)
  charitableFloorReduction?: number; // Charitable giving under the AGI floor
}

export interface FicaBreakdown {
  socialSecurityTax: number;
  socialSecurityWages: number;
  medicareTax: number;
  additionalMedicareTax: number;
  totalFica: number;
}

export interface NIITBreakdown {
  netInvestmentIncome: number;
  magiOverThreshold: number;
  taxableAmount: number;
  tax: number;
}

export interface QbiDeduction {
  finalDeduction: number;
  phaseoutApplied: boolean;
  qualifiedBusinessIncome: number;
  taxableIncomeLimit: number;
  tentativeDeduction: number;
}

export interface SelfEmploymentTaxBreakdown {
  additionalMedicareTax: number; // 0.9% of net earnings over the threshold left after wages
  deductibleHalf: number;
  medicareTax: number;
  netEarnings: number;
  socialSecurityTax: number;
  totalSETax: number; // Social Security plus Medicare; excludes Additional Medicare
}

// Colorado additions to and subtractions from federal taxable income
export interface ColoradoAdjustments {
  charitableSubtraction: number;
  treasuryInterestSubtraction: number;
  deductionAddback: number; // State income tax and high-income deduction addback
  federalTaxableIncome: number;
}

export interface SafeHarbor {
  currentYear90Percent: number;
  priorYearSafeHarbor: number;
  minimum: number;
  met: boolean;
  remaining: number;
  priorYearPercent?: number; // Share of last year's tax that was required
  highIncomeException?: boolean; // CA only - prior-year method unavailable
}

export interface TaxCalculationResult {
  // Income breakdown
  wageIncome: number;
  shortTermCapitalGains: number;
  longTermCapitalGains: number;
  interestIncome?: number; // Taxable interest
  ordinaryDividends?: number; // Total dividends, including qualified
  qualifiedDividends?: number; // Portion of ordinaryDividends taxed at LTCG rates
  grossIncome: number;
  // Loss offsets cover current year losses and prior year carryovers, whether
  // used against gains or deducted from other income (up to the annual limit)
  shortTermLossCarryoverOffset: number;
  shortTermLossCarryoverUnused?: number; // Carries over to next year
  longTermLossCarryoverOffset: number;
  longTermLossCarryoverUnused?: number; // Carries over to next year
  contributions401k: number;
  preTaxMedical: number;
  selfEmploymentIncome?: number; // For state displays
  deductibleSETax?: number; // For state displays
  adjustedGrossIncome: number; // Before the standard or itemized deduction

  // Deduction details
  deductionBreakdown: DeductionBreakdown;

  // Taxable income
  taxableOrdinaryIncome: number;
  taxableLTCG: number; // Federal: net long-term gains plus qualified dividends

  // Tax by bracket
  ordinaryIncomeBracketBreakdown: BracketBreakdown[];
  ltcgBracketBreakdown: BracketBreakdown[];

  // Tax totals
  ordinaryIncomeTax: number;
  ltcgTax: number;
  caMentalHealthTax?: number; // California only - 1% on income over $1M
  coloradoAdjustments?: ColoradoAdjustments; // Colorado only
  propertyTaxCredit?: number; // Illinois only - credit for property tax paid
  nyTaxBenefitRecapture?: number; // New York only - recapture added to bracket tax
  nycTax?: number; // New York City local tax (before the school tax credit)
  nycSchoolTaxCredit?: number; // New York City school tax credit
  nycBracketBreakdown?: BracketBreakdown[]; // NYC tax bracket breakdown
  ficaBreakdown?: FicaBreakdown;
  niitBreakdown?: NIITBreakdown;
  qbiDeduction?: QbiDeduction;
  selfEmploymentTaxBreakdown?: SelfEmploymentTaxBreakdown;
  totalTax: number;

  // Payments already made
  withheld: number;
  withheldEstimated?: boolean; // Withholding was estimated from wages, not entered
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
