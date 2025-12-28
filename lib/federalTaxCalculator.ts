import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionsData,
  SharedLimitsData,
  FederalLimitsData,
  FicaData,
  FicaBreakdown,
  FilingStatus,
} from './types';
import { calculateFederalDeductions } from './deductionCalculator';
import { calculateTaxByBrackets, calculateLTCGTaxWithStacking } from './taxUtils';
import { calculatePaymentSummary, calculateSafeHarbor } from './states/stateCalcUtils';

function calculateFicaTaxes(
  wageIncome: number,
  filingStatus: FilingStatus,
  ficaData: FicaData
): FicaBreakdown {
  // Social Security: 6.2% up to wage base cap
  const socialSecurityWages = Math.min(wageIncome, ficaData.socialSecurity.wageBaseCap);
  const socialSecurityTax = socialSecurityWages * ficaData.socialSecurity.rate;

  // Medicare: 1.45% on all wages
  const medicareTax = wageIncome * ficaData.medicareBase.rate;

  // Additional Medicare: 0.9% on wages over threshold
  const medicareThreshold = ficaData.medicareAdditional.thresholds[filingStatus];
  const additionalMedicareWages = Math.max(0, wageIncome - medicareThreshold);
  const additionalMedicareTax = additionalMedicareWages * ficaData.medicareAdditional.rate;

  return {
    socialSecurityTax,
    socialSecurityWages,
    medicareTax,
    additionalMedicareTax,
    totalFica: socialSecurityTax + medicareTax + additionalMedicareTax,
  };
}

export function calculateFederalTax(
  inputs: TaxInputs,
  federalBrackets: TaxBracketsData,
  ltcgBrackets: TaxBracketsData,
  federalDeductions: DeductionsData,
  sharedLimits: SharedLimitsData,
  federalLimits: FederalLimitsData,
  ficaData?: FicaData
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Step 1: Calculate Gross Income
  // Short-term capital gains are taxed as ordinary income
  const grossOrdinaryIncome = inputs.federalIncome + inputs.shortTermCapitalGains;
  const grossIncome = grossOrdinaryIncome + inputs.longTermCapitalGains;

  // Step 1b: Apply short-term loss carryover
  // First offset short-term gains, then ordinary income up to limit
  const stCarryover = inputs.priorYearShortTermLossCarryover;
  const stGainsOffset = Math.min(stCarryover, inputs.shortTermCapitalGains);
  const remainingCarryover = stCarryover - stGainsOffset;

  const ordinaryIncomeLimit = filingStatus === 'marriedFilingSeparately'
    ? sharedLimits.capitalLossLimit.marriedFilingSeparately
    : sharedLimits.capitalLossLimit.default;
  const ordinaryIncomeOffset = remainingCarryover > 0 && inputs.federalIncome > 0
    ? Math.min(remainingCarryover, ordinaryIncomeLimit, inputs.federalIncome)
    : 0;

  const shortTermLossCarryoverOffset = stGainsOffset + ordinaryIncomeOffset;
  const shortTermLossCarryoverUnused = stCarryover - shortTermLossCarryoverOffset;

  // Step 1c: Long-term loss carryover is applied AFTER we know taxable ordinary income
  // (for smart 0% bracket optimization - see Step 4b below)
  const ltCarryover = inputs.priorYearLongTermLossCarryover;

  // Step 2: Calculate ordinary AGI (for tax bracket calculation)
  // 401k reduces ordinary income, not capital gains
  const agiOrdinary = Math.max(0, grossOrdinaryIncome - shortTermLossCarryoverOffset - inputs.contributions401k);

  // Pre-deduction AGI for SALT cap threshold
  // Use conservative estimate (before LT carryover optimization)
  const preDeductionAgi = grossIncome - shortTermLossCarryoverOffset - inputs.contributions401k;

  // Step 3: Calculate deductions
  const deductionBreakdown = calculateFederalDeductions(
    {
      propertyTaxesPaid: inputs.propertyTaxesPaid,
      mortgageInterestPaid: inputs.mortgageInterestPaid,
      mortgageBalance: inputs.mortgageBalance,
      charitableContributions: inputs.charitableContributions,
      stateTaxWithheld: inputs.stateTaxWithheld,
      stateEstimatedPaid: inputs.stateEstimatedPaid,
    },
    filingStatus,
    federalDeductions,
    federalLimits,
    preDeductionAgi
  );

  // Step 4: Calculate taxable ordinary income
  // Deductions apply to ordinary income first
  const taxableOrdinaryIncome = Math.max(
    0,
    agiOrdinary - deductionBreakdown.deductionAmount
  );

  // Step 4b: Apply long-term loss carryover SMARTLY
  // Only use carryover to offset LTCG that would be taxed (not 0% bracket)
  // This preserves carryover for future years when it provides actual tax savings
  const zeroPercentThreshold = ltcgBrackets.brackets[filingStatus][0].max ?? 0;
  const roomInZeroBracket = Math.max(0, zeroPercentThreshold - taxableOrdinaryIncome);
  const ltcgInZeroBracket = Math.min(inputs.longTermCapitalGains, roomInZeroBracket);
  const ltcgInTaxedBrackets = inputs.longTermCapitalGains - ltcgInZeroBracket;

  // Only apply carryover to offset gains that would actually be taxed
  const longTermLossCarryoverOffset = Math.min(ltCarryover, ltcgInTaxedBrackets);
  const longTermLossCarryoverUnused = ltCarryover - longTermLossCarryoverOffset;

  // Step 4c: Calculate taxable LTCG (after smart carryover)
  const taxableLTCG = inputs.longTermCapitalGains - longTermLossCarryoverOffset;

  // Step 4d: Calculate AGI (includes all deductions for display)
  const adjustedGrossIncome = grossIncome
    - shortTermLossCarryoverOffset
    - longTermLossCarryoverOffset
    - inputs.contributions401k
    - deductionBreakdown.deductionAmount;

  // Step 5: Calculate ordinary income tax
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    federalBrackets.brackets[filingStatus]
  );

  // Step 6: Calculate LTCG tax with proper stacking on ordinary income
  // LTCG brackets are based on TOTAL taxable income, so ordinary income
  // "fills up" the lower brackets first
  const ltcgTax = calculateLTCGTaxWithStacking(
    taxableLTCG,
    taxableOrdinaryIncome,
    ltcgBrackets.brackets[filingStatus]
  );

  // Step 7: Calculate FICA taxes (on W-2 wage income only, not capital gains)
  const ficaBreakdown = ficaData
    ? calculateFicaTaxes(inputs.federalIncome, filingStatus, ficaData)
    : undefined;

  // Step 8: Sum up taxes
  const totalTax = ordinaryTax.total + ltcgTax.total + (ficaBreakdown?.totalFica ?? 0);

  // Step 9: Calculate remaining owed using shared utility
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.federalTaxWithheld,
    inputs.federalEstimatedPaid
  );

  // Step 10: Calculate safe harbor using shared utility
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearFederalTaxPaid,
    {
      currentYearPercent: federalLimits.safeHarbor.currentYearPercent,
      priorYearPercent: federalLimits.safeHarbor.priorYearPercent,
    }
  );

  return {
    wageIncome: inputs.federalIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    grossIncome,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
    longTermLossCarryoverOffset,
    longTermLossCarryoverUnused,
    contributions401k: inputs.contributions401k,
    adjustedGrossIncome,
    deductionBreakdown,
    taxableOrdinaryIncome,
    taxableLTCG,
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: ltcgTax.breakdown,
    ordinaryIncomeTax: ordinaryTax.total,
    ltcgTax: ltcgTax.total,
    ficaBreakdown,
    totalTax,
    withheld: inputs.federalTaxWithheld,
    estimatedPaid: inputs.federalEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
