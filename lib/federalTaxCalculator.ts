import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  DeductionChoice,
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
import {
  applyFederalItemizedLimit,
  calculateFederalDeductions,
} from "./deductionCalculator";
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
  selectPriorYearPercent,
} from "./states/stateCalcUtils";
import { earnerWages } from "./earners";

function calculateFicaTaxes(
  inputs: TaxInputs,
  ficaData: FicaData,
): FicaBreakdown {
  const wageIncome = inputs.federalIncome;
  const wagesByEarner = earnerWages(inputs);
  const { medicareAdditional, medicareBase, socialSecurity } = ficaData;

  // Social Security: 6.2% of each earner's wages up to the wage base
  const socialSecurityWages = wagesByEarner.reduce(
    (sum, wages) => sum + Math.min(wages, socialSecurity.wageBaseCap),
    0,
  );
  const socialSecurityTax = socialSecurityWages * socialSecurity.rate;

  // Medicare: 1.45% on all wages
  const medicareTax = wageIncome * medicareBase.rate;

  // Additional Medicare: 0.9% of all wages over the filing status threshold
  const medicareThreshold = medicareAdditional.thresholds[inputs.filingStatus];
  const additionalMedicareTax =
    Math.max(0, wageIncome - medicareThreshold) * medicareAdditional.rate;

  // What employers withhold toward it: 0.9% of each earner's wages over
  // $200,000, whatever the filing status (Form 8959 Part V). The two differ
  // for a couple with two earners and for a separate return.
  const additionalMedicareWithheld = wagesByEarner.reduce(
    (sum, wages) =>
      sum +
      Math.max(0, wages - medicareAdditional.withholdingThreshold) *
        medicareAdditional.rate,
    0,
  );

  return {
    socialSecurityTax,
    socialSecurityWages,
    medicareTax,
    additionalMedicareTax,
    additionalMedicareWithheld,
    totalFica: socialSecurityTax + medicareTax + additionalMedicareTax,
  };
}

function calculateSelfEmploymentTax(
  netProfit: number,
  ownWages: number,
  allWages: number,
  filingStatus: FilingStatus,
  ficaData: FicaData,
): SelfEmploymentTaxBreakdown {
  const seData = ficaData.selfEmployment;

  // Net earnings = 92.35% of net profit (equivalent to employer half of FICA)
  const netEarnings = netProfit * seData.netEarningsRate;

  // Social Security: 12.4% up to the wage base left after this earner's wages
  const remainingSsRoom = Math.max(
    0,
    ficaData.socialSecurity.wageBaseCap - ownWages,
  );
  const ssEarnings = Math.min(netEarnings, remainingSsRoom);
  const socialSecurityTax = ssEarnings * seData.socialSecurityRate;

  // Medicare: 2.9% on all net earnings
  const medicareTax = netEarnings * seData.medicareRate;

  const totalSETax = socialSecurityTax + medicareTax;
  const deductibleHalf = totalSETax * seData.deductiblePortion;

  // Additional Medicare: 0.9% of net earnings over the threshold, which is
  // first used up by wages (Form 8959 Part II). Nobody withholds it, and it
  // is not part of the deductible half.
  const additionalMedicareThreshold = Math.max(
    0,
    ficaData.medicareAdditional.thresholds[filingStatus] - allWages,
  );
  const additionalMedicareTax =
    Math.max(0, netEarnings - additionalMedicareThreshold) *
    ficaData.medicareAdditional.rate;

  return {
    additionalMedicareTax,
    deductibleHalf,
    medicareTax,
    netEarnings,
    socialSecurityTax,
    totalSETax,
  };
}

function calculateQbiDeduction(
  qualifiedBusinessIncome: number,
  taxableOrdinaryIncomeBeforeQbi: number,
  taxableIncomeBeforeQbi: number,
  filingStatus: FilingStatus,
  limits: FederalLimitsData,
): QbiDeduction {
  // The 20% income limit excludes income taxed at long-term capital gains
  // rates, but the phaseout threshold is tested against total taxable income
  const tentativeDeduction = qualifiedBusinessIncome * limits.qbiDeduction.rate;
  const taxableIncomeLimit =
    taxableOrdinaryIncomeBeforeQbi * limits.qbiDeduction.rate;

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
    qualifiedBusinessIncome,
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
  deductionChoice?: DeductionChoice,
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
  // SE tax must be calculated early because half is deductible above-the-line.
  // The business is treated as the first earner's, so only their wages use up
  // the Social Security wage base; the Additional Medicare threshold is
  // reduced by the couple's combined wages (Form 8959 Part II).
  const selfEmploymentTaxBreakdown =
    selfEmploymentIncome > 0 && ficaData
      ? calculateSelfEmploymentTax(
          selfEmploymentIncome,
          earnerWages(inputs)[0],
          inputs.federalIncome,
          filingStatus,
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

  // Adjusted gross income: income after above-the-line deductions, before
  // the standard or itemized deduction. Drives the SALT cap and NIIT thresholds.
  const adjustedGrossIncome =
    grossIncome -
    shortTermLossCarryoverOffset -
    longTermLossCarryoverOffset -
    preTaxDeductions;

  // Step 3: Calculate deductions (before the overall itemized limitation)
  const baseDeductionBreakdown = calculateFederalDeductions(
    inputs,
    filingStatus,
    federalDeductions,
    federalLimits,
    adjustedGrossIncome,
    deductionChoice,
  );

  // Step 4: Taxable income for a given deduction (before QBI)
  // Deductions apply to ordinary income first; any excess reduces income
  // taxed at long-term capital gains rates (net long-term gains plus
  // qualified dividends)
  const taxableIncomeFor = (deductionAmount: number) => {
    const ordinaryAfterDeductions = agiOrdinary - deductionAmount;
    return {
      ordinary: Math.max(0, ordinaryAfterDeductions),
      preferential: Math.max(
        0,
        preferentialIncome - Math.max(0, -ordinaryAfterDeductions),
      ),
    };
  };

  // QBI is 20% of qualified business income, limited to 20% of taxable
  // ordinary income, and phases out based on total taxable income. Qualified
  // business income is the business income less the deductions that go with
  // it, here the deductible half of self-employment tax.
  const qualifiedBusinessIncome = selfEmploymentIncome - deductibleSETax;
  const qbiDeductionFor = (taxable: {
    ordinary: number;
    preferential: number;
  }) =>
    selfEmploymentIncome > 0 && taxable.ordinary > 0
      ? calculateQbiDeduction(
          qualifiedBusinessIncome,
          taxable.ordinary,
          taxable.ordinary + taxable.preferential,
          filingStatus,
          federalLimits,
        )
      : undefined;

  // Step 4a: Apply the overall limitation on itemized deductions. The QBI
  // deduction is determined without regard to it.
  const baseQbiDeduction = qbiDeductionFor(
    taxableIncomeFor(baseDeductionBreakdown.deductionAmount),
  );
  const topBracketStart =
    federalBrackets.brackets[filingStatus].at(-1)?.min ?? Infinity;
  const deductionBreakdown = applyFederalItemizedLimit(
    baseDeductionBreakdown,
    adjustedGrossIncome - (baseQbiDeduction?.finalDeduction ?? 0),
    topBracketStart,
    federalLimits,
    deductionChoice,
  );

  // Step 4b: Final taxable income and QBI deduction
  const {
    ordinary: taxableOrdinaryIncomeBeforeQbi,
    preferential: taxableLTCG,
  } = taxableIncomeFor(deductionBreakdown.deductionAmount);
  const qbiDeduction =
    deductionBreakdown.deductionUsed === baseDeductionBreakdown.deductionUsed
      ? baseQbiDeduction
      : qbiDeductionFor({
          ordinary: taxableOrdinaryIncomeBeforeQbi,
          preferential: taxableLTCG,
        });
  const qbiAmount = qbiDeduction?.finalDeduction ?? 0;

  // Taxable ordinary income after QBI deduction
  const taxableOrdinaryIncome = Math.max(
    0,
    taxableOrdinaryIncomeBeforeQbi - qbiAmount,
  );

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

  // Step 7: Calculate payroll taxes (on W-2 wage income only, not investment
  // income). Social Security and base Medicare are shown for information:
  // employers withhold exactly those amounts from each paycheck. Additional
  // Medicare is tax settled on the return, with what employers withheld
  // toward it credited as a payment (Form 8959).
  const ficaBreakdown = ficaData
    ? calculateFicaTaxes(inputs, ficaData)
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
  const magiOverThreshold = Math.max(0, adjustedGrossIncome - niitThreshold);
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

  // Step 8: Sum up the taxes settled on the return. Nonrefundable credits
  // come off the income tax first and cannot take it below zero (Form 1040
  // line 22); self-employment tax, NIIT and Additional Medicare are added
  // after them (Schedule 2). Social Security and base Medicare on wages are
  // not part of the return.
  const incomeTax = ordinaryTax.total + ltcgTax.total;
  const taxCredits = Math.min(incomeTax, Math.max(0, inputs.federalTaxCredits));
  const seTax =
    (selfEmploymentTaxBreakdown?.totalSETax ?? 0) +
    (selfEmploymentTaxBreakdown?.additionalMedicareTax ?? 0);
  const additionalMedicareOnWages = ficaBreakdown?.additionalMedicareTax ?? 0;
  const totalTax =
    incomeTax - taxCredits + seTax + niitTax + additionalMedicareOnWages;

  // Step 9: Calculate remaining owed using shared utility. The Additional
  // Medicare that employers withheld counts with the income tax withheld
  // (Form 1040 line 25c).
  const additionalMedicareWithheld =
    ficaBreakdown?.additionalMedicareWithheld ?? 0;
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.federalTaxWithheld + additionalMedicareWithheld,
    inputs.federalEstimatedPaid,
  );

  // Step 10: Calculate safe harbor using shared utility
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearFederalTax,
    {
      currentYearPercent: federalLimits.safeHarbor.currentYearPercent,
      priorYearPercent: selectPriorYearPercent(
        federalLimits.safeHarbor,
        inputs,
      ),
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
    ...(taxCredits > 0 && { taxCredits }),
    totalTax,
    withheld: inputs.federalTaxWithheld,
    ...(additionalMedicareWithheld > 0 && { additionalMedicareWithheld }),
    estimatedPaid: inputs.federalEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
