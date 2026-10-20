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
} from "./types";
import { calculateFederalDeductions } from "./deductionCalculator";
import {
  calculateLTCGTaxWithStacking,
  calculateTaxByBrackets,
  netCapitalGains,
  splitDividends,
  taxableInterest,
} from "./taxUtils";
import {
  calculatePaymentSummary,
  calculateSafeHarbor,
} from "./states/stateCalcUtils";

function calculateFicaTaxes(
  wageIncome: number,
  filingStatus: FilingStatus,
  ficaData: FicaData,
): FicaBreakdown {
  // Social Security: 6.2% up to wage base cap
  const socialSecurityWages = Math.min(
    wageIncome,
    ficaData.socialSecurity.wageBaseCap,
  );
  const socialSecurityTax = socialSecurityWages * ficaData.socialSecurity.rate;

  // Medicare: 1.45% on all wages
  const medicareTax = wageIncome * ficaData.medicareBase.rate;

  // Additional Medicare: 0.9% on wages over threshold
  const medicareThreshold =
    ficaData.medicareAdditional.thresholds[filingStatus];
  const additionalMedicareWages = Math.max(0, wageIncome - medicareThreshold);
  const additionalMedicareTax =
    additionalMedicareWages * ficaData.medicareAdditional.rate;

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
  ficaData: FicaData,
): SelfEmploymentTaxBreakdown {
  const seData = ficaData.selfEmployment;

  // Net earnings = 92.35% of net profit (equivalent to employer half of FICA)
  const netEarnings = netProfit * seData.netEarningsRate;

  // Social Security: 12.4% up to remaining wage base after W-2 wages
  const remainingSsRoom = Math.max(
    0,
    ficaData.socialSecurity.wageBaseCap - wageIncome,
  );
  const ssEarnings = Math.min(netEarnings, remainingSsRoom);
  const socialSecurityTax = ssEarnings * seData.socialSecurityRate;

  // Medicare: 2.9% on all net earnings
  const medicareTax = netEarnings * seData.medicareRate;

  const totalSETax = socialSecurityTax + medicareTax;
  const deductibleHalf = totalSETax * seData.deductiblePortion;

  return {
    deductibleHalf,
    medicareTax,
    netEarnings,
    socialSecurityTax,
    totalSETax,
  };
}

function calculateQbiDeduction(
  selfEmploymentIncome: number,
  taxableIncomeBeforeQbi: number,
  filingStatus: FilingStatus,
  limits: FederalLimitsData,
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
  ficaData?: FicaData,
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Step 1: Calculate Gross Income
  // Short-term capital gains, interest, non-qualified dividends, and
  // self-employment income are taxed as ordinary income. Capital losses are
  // netted below.
  const selfEmploymentIncome = inputs.selfEmploymentIncome ?? 0;
  const interestIncome = taxableInterest(inputs);
  const dividends = splitDividends(inputs);
  const otherIncome =
    inputs.federalIncome +
    selfEmploymentIncome +
    interestIncome +
    dividends.ordinary;

  // Step 1b: Net capital gains and losses (Schedule D)
  const capitalGains = netCapitalGains(
    inputs,
    filingStatus,
    sharedLimits,
    otherIncome,
  );
  const shortTermLossCarryoverOffset = capitalGains.shortTermLossOffset;
  const shortTermLossCarryoverUnused = capitalGains.shortTermLossUnused;
  const longTermLossCarryoverOffset = capitalGains.longTermLossOffset;
  const longTermLossCarryoverUnused = capitalGains.longTermLossUnused;

  const grossIncome =
    otherIncome + capitalGains.shortTermGains + capitalGains.longTermGains;

  // Income taxed at long-term capital gains rates (before deductions)
  const preferentialIncome = dividends.qualified + capitalGains.netLongTermGain;

  // Step 1.5: Calculate Self-Employment Tax (if applicable)
  // SE tax must be calculated early because half is deductible above-the-line
  const selfEmploymentTaxBreakdown =
    selfEmploymentIncome > 0 && ficaData
      ? calculateSelfEmploymentTax(
          selfEmploymentIncome,
          inputs.federalIncome,
          ficaData,
        )
      : undefined;
  const deductibleSETax = selfEmploymentTaxBreakdown?.deductibleHalf ?? 0;

  // Step 2: Calculate ordinary AGI (for tax bracket calculation)
  // 401k, pre-tax medical, and deductible SE tax reduce ordinary income first
  const preTaxDeductions =
    inputs.contributions401k + inputs.preTaxMedical + deductibleSETax;
  const agiOrdinary =
    inputs.federalIncome +
    selfEmploymentIncome +
    interestIncome +
    dividends.nonQualified +
    capitalGains.netShortTermGain -
    capitalGains.ordinaryIncomeDeduction -
    preTaxDeductions;

  // Pre-deduction AGI for SALT cap and NIIT thresholds
  const preDeductionAgi =
    grossIncome -
    shortTermLossCarryoverOffset -
    longTermLossCarryoverOffset -
    preTaxDeductions;

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
    preDeductionAgi,
  );

  // Step 4: Calculate taxable ordinary income (before QBI)
  // Deductions apply to ordinary income first; any excess reduces income
  // taxed at long-term capital gains rates
  const ordinaryAfterDeductions =
    agiOrdinary - deductionBreakdown.deductionAmount;
  const taxableOrdinaryIncomeBeforeQbi = Math.max(0, ordinaryAfterDeductions);
  const excessDeductions = Math.max(0, -ordinaryAfterDeductions);

  // Step 4a: Calculate QBI deduction (if applicable)
  // QBI is 20% of qualified business income, limited to 20% of taxable income
  // Phase out starts at $191,950 single / $383,900 MFJ
  const qbiDeduction =
    selfEmploymentIncome > 0 && taxableOrdinaryIncomeBeforeQbi > 0
      ? calculateQbiDeduction(
          selfEmploymentIncome,
          taxableOrdinaryIncomeBeforeQbi,
          filingStatus,
          federalLimits,
        )
      : undefined;
  const qbiAmount = qbiDeduction?.finalDeduction ?? 0;

  // Taxable ordinary income after QBI deduction
  const taxableOrdinaryIncome = Math.max(
    0,
    taxableOrdinaryIncomeBeforeQbi - qbiAmount,
  );

  // Step 4b: Calculate income taxed at long-term capital gains rates
  // (net long-term gains plus qualified dividends)
  const taxableLTCG = Math.max(0, preferentialIncome - excessDeductions);

  // Step 4d: Calculate AGI (includes all deductions for display)
  const adjustedGrossIncome =
    grossIncome -
    shortTermLossCarryoverOffset -
    longTermLossCarryoverOffset -
    preTaxDeductions -
    deductionBreakdown.deductionAmount -
    qbiAmount;

  // Step 5: Calculate ordinary income tax
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    federalBrackets.brackets[filingStatus],
  );

  // Step 6: Calculate LTCG tax with proper stacking on ordinary income
  // LTCG brackets are based on TOTAL taxable income, so ordinary income
  // "fills up" the lower brackets first
  const ltcgTax = calculateLTCGTaxWithStacking(
    taxableLTCG,
    taxableOrdinaryIncome,
    ltcgBrackets.brackets[filingStatus],
  );

  // Step 7: Calculate FICA taxes (on W-2 wage income only, not investment income)
  const ficaBreakdown = ficaData
    ? calculateFicaTaxes(inputs.federalIncome, filingStatus, ficaData)
    : undefined;

  // Step 7.5: Calculate NIIT (3.8% Net Investment Income Tax for high earners)
  // NIIT applies to the lesser of:
  // 1. Net investment income (interest, dividends, and capital gains after losses)
  // 2. MAGI exceeding threshold
  const netInvestmentIncome = Math.max(
    0,
    interestIncome +
      dividends.ordinary +
      capitalGains.netShortTermGain +
      capitalGains.netLongTermGain -
      capitalGains.ordinaryIncomeDeduction,
  );
  const niitThreshold = federalLimits.niit.thresholds[filingStatus];
  const magiOverThreshold = Math.max(0, preDeductionAgi - niitThreshold);
  const niitTaxableAmount = Math.min(netInvestmentIncome, magiOverThreshold);
  const niitTax =
    niitTaxableAmount > 0 ? niitTaxableAmount * federalLimits.niit.rate : 0;
  const niitBreakdown: NIITBreakdown | undefined =
    niitTax > 0
      ? {
          netInvestmentIncome,
          magiOverThreshold,
          taxableAmount: niitTaxableAmount,
          tax: niitTax,
        }
      : undefined;

  // Step 8: Sum up taxes
  const seTax = selfEmploymentTaxBreakdown?.totalSETax ?? 0;
  const totalTax =
    ordinaryTax.total +
    ltcgTax.total +
    (ficaBreakdown?.totalFica ?? 0) +
    seTax +
    niitTax;

  // Step 9: Calculate remaining owed using shared utility
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.federalTaxWithheld,
    inputs.federalEstimatedPaid,
  );

  // Step 10: Calculate safe harbor using shared utility
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearFederalTaxPaid,
    {
      currentYearPercent: federalLimits.safeHarbor.currentYearPercent,
      priorYearPercent: federalLimits.safeHarbor.priorYearPercent,
    },
  );

  return {
    wageIncome: inputs.federalIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    interestIncome,
    ordinaryDividends: dividends.ordinary,
    qualifiedDividends: dividends.qualified,
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
