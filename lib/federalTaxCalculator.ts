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
  NIITBreakdown,
  QbiDeduction,
  SelfEmploymentTaxBreakdown,
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

function calculateSelfEmploymentTax(
  netProfit: number,
  wageIncome: number,
  ficaData: FicaData
): SelfEmploymentTaxBreakdown {
  const seData = ficaData.selfEmployment;

  // Net earnings = 92.35% of net profit (equivalent to employer half of FICA)
  const netEarnings = netProfit * seData.netEarningsRate;

  // Social Security: 12.4% up to remaining wage base after W-2 wages
  const remainingSsRoom = Math.max(0, ficaData.socialSecurity.wageBaseCap - wageIncome);
  const ssEarnings = Math.min(netEarnings, remainingSsRoom);
  const socialSecurityTax = ssEarnings * seData.socialSecurityRate;

  // Medicare: 2.9% on all net earnings
  const medicareTax = netEarnings * seData.medicareRate;

  const totalSETax = socialSecurityTax + medicareTax;
  const deductibleHalf = totalSETax * seData.deductiblePortion;

  return { deductibleHalf, medicareTax, netEarnings, socialSecurityTax, totalSETax };
}

function calculateQbiDeduction(
  selfEmploymentIncome: number,
  taxableIncomeBeforeQbi: number,
  filingStatus: FilingStatus,
  limits: FederalLimitsData
): QbiDeduction {
  const tentativeDeduction = selfEmploymentIncome * limits.qbiDeduction.rate;
  const taxableIncomeLimit = taxableIncomeBeforeQbi * limits.qbiDeduction.rate;

  let finalDeduction = Math.min(tentativeDeduction, taxableIncomeLimit);
  let phaseoutApplied = false;

  const threshold = limits.qbiDeduction.taxableIncomeThreshold[filingStatus];
  if (taxableIncomeBeforeQbi > threshold) {
    const range = limits.qbiDeduction.phaseoutRange[filingStatus];
    const excess = taxableIncomeBeforeQbi - threshold;
    const phaseoutRatio = Math.min(1, excess / range);
    finalDeduction = finalDeduction * (1 - phaseoutRatio);
    phaseoutApplied = true;
  }

  return {
    finalDeduction: Math.max(0, finalDeduction),
    phaseoutApplied,
    qualifiedBusinessIncome: selfEmploymentIncome,
    taxableIncomeLimit,
    tentativeDeduction,
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

  // Clamp negative capital gains to 0 (current year losses become carryover)
  const effectiveSTCG = Math.max(0, inputs.shortTermCapitalGains);
  const effectiveLTCG = Math.max(0, inputs.longTermCapitalGains);
  const currentYearSTLoss = Math.max(0, -inputs.shortTermCapitalGains);

  // Step 1: Calculate Gross Income
  // Short-term capital gains and self-employment income are taxed as ordinary income
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const grossOrdinaryIncome = inputs.federalIncome + effectiveSTCG + selfEmploymentIncome;
  const grossIncome = grossOrdinaryIncome + effectiveLTCG;

  // Step 1.5: Calculate Self-Employment Tax (if applicable)
  // SE tax must be calculated early because half is deductible above-the-line
  const selfEmploymentTaxBreakdown = selfEmploymentIncome > 0 && ficaData
    ? calculateSelfEmploymentTax(selfEmploymentIncome, inputs.federalIncome, ficaData)
    : undefined;
  const deductibleSETax = selfEmploymentTaxBreakdown?.deductibleHalf ?? 0;

  // Step 1b: Apply short-term loss carryover (includes current year losses)
  // First offset short-term gains, then ordinary income up to limit
  const stCarryover = inputs.priorYearShortTermLossCarryover + currentYearSTLoss;
  const stGainsOffset = Math.min(stCarryover, effectiveSTCG);
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
  // 401k, pre-tax medical, and deductible SE tax reduce ordinary income, not capital gains
  const preTaxDeductions = inputs.contributions401k + inputs.preTaxMedical + deductibleSETax;
  const agiOrdinary = Math.max(0, grossOrdinaryIncome - shortTermLossCarryoverOffset - preTaxDeductions);

  // Pre-deduction AGI for SALT cap threshold
  // Use conservative estimate (before LT carryover optimization)
  const preDeductionAgi = grossIncome - shortTermLossCarryoverOffset - preTaxDeductions;

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

  // Step 4: Calculate taxable ordinary income (before QBI)
  // Deductions apply to ordinary income first
  const taxableOrdinaryIncomeBeforeQbi = Math.max(
    0,
    agiOrdinary - deductionBreakdown.deductionAmount
  );

  // Step 4a: Calculate QBI deduction (if applicable)
  // QBI is 20% of qualified business income, limited to 20% of taxable income
  // Phase out starts at $191,950 single / $383,900 MFJ
  const qbiDeduction = selfEmploymentIncome > 0 && taxableOrdinaryIncomeBeforeQbi > 0
    ? calculateQbiDeduction(selfEmploymentIncome, taxableOrdinaryIncomeBeforeQbi, filingStatus, federalLimits)
    : undefined;
  const qbiAmount = qbiDeduction?.finalDeduction ?? 0;

  // Taxable ordinary income after QBI deduction
  const taxableOrdinaryIncome = Math.max(0, taxableOrdinaryIncomeBeforeQbi - qbiAmount);

  // Step 4b: Apply long-term loss carryover SMARTLY
  // Only use carryover to offset LTCG that would be taxed (not 0% bracket)
  // This preserves carryover for future years when it provides actual tax savings
  const zeroPercentThreshold = ltcgBrackets.brackets[filingStatus][0].max ?? 0;
  const roomInZeroBracket = Math.max(0, zeroPercentThreshold - taxableOrdinaryIncome);
  const ltcgInZeroBracket = Math.min(effectiveLTCG, roomInZeroBracket);
  const ltcgInTaxedBrackets = effectiveLTCG - ltcgInZeroBracket;

  // Only apply carryover to offset gains that would actually be taxed
  const longTermLossCarryoverOffset = Math.min(ltCarryover, ltcgInTaxedBrackets);
  const longTermLossCarryoverUnused = ltCarryover - longTermLossCarryoverOffset;

  // Step 4c: Calculate taxable LTCG (after smart carryover)
  const taxableLTCG = effectiveLTCG - longTermLossCarryoverOffset;

  // Step 4d: Calculate AGI (includes all deductions for display)
  const adjustedGrossIncome = grossIncome
    - shortTermLossCarryoverOffset
    - longTermLossCarryoverOffset
    - preTaxDeductions
    - deductionBreakdown.deductionAmount
    - qbiAmount;

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

  // Step 7.5: Calculate NIIT (3.8% Net Investment Income Tax for high earners)
  // NIIT applies to the lesser of:
  // 1. Net investment income (capital gains after losses)
  // 2. MAGI exceeding threshold
  const netInvestmentIncome = Math.max(0,
    effectiveSTCG + effectiveLTCG - shortTermLossCarryoverOffset - longTermLossCarryoverOffset
  );
  const niitThreshold = federalLimits.niit.thresholds[filingStatus];
  const magiOverThreshold = Math.max(0, preDeductionAgi - niitThreshold);
  const niitTaxableAmount = Math.min(netInvestmentIncome, magiOverThreshold);
  const niitTax = niitTaxableAmount > 0 ? niitTaxableAmount * federalLimits.niit.rate : 0;
  const niitBreakdown: NIITBreakdown | undefined = niitTax > 0 ? {
    netInvestmentIncome,
    magiOverThreshold,
    taxableAmount: niitTaxableAmount,
    tax: niitTax,
  } : undefined;

  // Step 8: Sum up taxes
  const seTax = selfEmploymentTaxBreakdown?.totalSETax ?? 0;
  const totalTax = ordinaryTax.total + ltcgTax.total + (ficaBreakdown?.totalFica ?? 0) + seTax + niitTax;

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
    preTaxMedical: inputs.preTaxMedical,
    adjustedGrossIncome,
    deductionBreakdown,
    taxableOrdinaryIncome,
    taxableLTCG,
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: ltcgTax.breakdown,
    ordinaryIncomeTax: ordinaryTax.total,
    ltcgTax: ltcgTax.total,
    ficaBreakdown,
    niitBreakdown,
    qbiDeduction,
    selfEmploymentTaxBreakdown,
    totalTax,
    withheld: inputs.federalTaxWithheld,
    estimatedPaid: inputs.federalEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
