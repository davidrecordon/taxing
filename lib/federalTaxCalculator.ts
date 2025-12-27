import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracket,
  BracketBreakdown,
  TaxBracketsData,
  DeductionsData,
  LimitsData,
  FicaData,
  FicaBreakdown,
  FilingStatus,
  SafeHarbor,
} from './types';
import { calculateFederalDeductions } from './deductionCalculator';

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

function calculateTaxByBrackets(
  taxableIncome: number,
  brackets: TaxBracket[]
): { total: number; breakdown: BracketBreakdown[] } {
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  const breakdown: BracketBreakdown[] = [];

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize =
      bracket.max !== null ? bracket.max - bracket.min : Infinity;

    const incomeInBracket = Math.min(remainingIncome, bracketSize);
    const taxForBracket = incomeInBracket * bracket.rate;

    if (incomeInBracket > 0) {
      breakdown.push({
        bracketMin: bracket.min,
        bracketMax: bracket.max,
        rate: bracket.rate,
        incomeInBracket,
        taxForBracket,
      });
    }

    totalTax += taxForBracket;
    remainingIncome -= incomeInBracket;
  }

  return { total: totalTax, breakdown };
}


export function calculateFederalTax(
  inputs: TaxInputs,
  federalBrackets: TaxBracketsData,
  ltcgBrackets: TaxBracketsData,
  federalDeductions: DeductionsData,
  limits: LimitsData,
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

  const ordinaryIncomeLimit = filingStatus === 'marriedFilingSeparately' ? 1500 : 3000;
  const ordinaryIncomeOffset = remainingCarryover > 0 && inputs.federalIncome > 0
    ? Math.min(remainingCarryover, ordinaryIncomeLimit, inputs.federalIncome)
    : 0;

  const shortTermLossCarryoverOffset = stGainsOffset + ordinaryIncomeOffset;

  // Step 1c: Apply long-term loss carryover (offsets LTCG only, not ordinary income)
  const ltCarryover = inputs.priorYearLongTermLossCarryover;
  const longTermLossCarryoverOffset = Math.min(ltCarryover, inputs.longTermCapitalGains);

  // Step 2: Calculate ordinary AGI (for tax bracket calculation)
  // 401k reduces ordinary income, not capital gains
  const agiOrdinary = Math.max(0, grossOrdinaryIncome - shortTermLossCarryoverOffset - inputs.contributions401k);

  // Pre-deduction AGI for SALT cap threshold (includes all income minus above-the-line deductions)
  const preDeductionAgi = grossIncome - shortTermLossCarryoverOffset - longTermLossCarryoverOffset - inputs.contributions401k;

  // Step 3: Calculate deductions
  const deductionBreakdown = calculateFederalDeductions(
    {
      propertyTaxesPaid: inputs.propertyTaxesPaid,
      mortgageInterestPaid: inputs.mortgageInterestPaid,
      mortgageBalance: inputs.mortgageBalance,
      charitableContributions: inputs.charitableContributions,
      californiaTaxWithheld: inputs.californiaTaxWithheld,
      californiaEstimatedPaid: inputs.californiaEstimatedPaid,
    },
    filingStatus,
    federalDeductions,
    limits,
    preDeductionAgi
  );

  // Step 3b: Calculate AGI (includes all deductions for display)
  const adjustedGrossIncome = grossIncome
    - shortTermLossCarryoverOffset
    - longTermLossCarryoverOffset
    - inputs.contributions401k
    - deductionBreakdown.deductionAmount;

  // Step 4: Calculate taxable income
  // Deductions apply to ordinary income first
  const taxableOrdinaryIncome = Math.max(
    0,
    agiOrdinary - deductionBreakdown.deductionAmount
  );
  // LTCG is reduced by long-term loss carryover
  const taxableLTCG = inputs.longTermCapitalGains - longTermLossCarryoverOffset;

  // Step 5: Calculate ordinary income tax
  const ordinaryTax = calculateTaxByBrackets(
    taxableOrdinaryIncome,
    federalBrackets.brackets[filingStatus]
  );

  // Step 6: Calculate LTCG tax (based only on LTCG amount, not stacked)
  const ltcgTax = calculateTaxByBrackets(
    taxableLTCG,
    ltcgBrackets.brackets[filingStatus]
  );

  // Step 7: Calculate FICA taxes (on W-2 wage income only, not capital gains)
  const ficaBreakdown = ficaData
    ? calculateFicaTaxes(inputs.federalIncome, filingStatus, ficaData)
    : undefined;

  // Step 8: Sum up taxes
  const totalTax = ordinaryTax.total + ltcgTax.total + (ficaBreakdown?.totalFica ?? 0);

  // Step 9: Calculate remaining owed
  const totalPaid = inputs.federalTaxWithheld + inputs.federalEstimatedPaid;
  const remainingOwed = Math.max(0, totalTax - totalPaid);
  const refundDue = Math.max(0, totalPaid - totalTax);

  // Step 10: Calculate safe harbor for estimated tax penalty avoidance
  // Only use 110% prior year rule if prior year tax was entered
  const safeHarbor90Percent = totalTax * 0.90;
  const safeHarbor110Percent = inputs.priorYearFederalTaxPaid * 1.10;
  const safeHarborMinimum = inputs.priorYearFederalTaxPaid > 0
    ? Math.min(safeHarbor90Percent, safeHarbor110Percent)
    : safeHarbor90Percent;
  const safeHarbor: SafeHarbor = {
    currentYear90Percent: safeHarbor90Percent,
    priorYear110Percent: safeHarbor110Percent,
    minimum: safeHarborMinimum,
    met: totalPaid >= safeHarborMinimum,
    remaining: Math.max(0, safeHarborMinimum - totalPaid),
  };

  return {
    wageIncome: inputs.federalIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    grossIncome,
    shortTermLossCarryoverOffset,
    longTermLossCarryoverOffset,
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
