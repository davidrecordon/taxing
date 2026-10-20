import {
  TaxInputs,
  TaxCalculationResult,
  TaxBracketsData,
  SharedLimitsData,
  ColoradoLimitsData,
  DeductionBreakdown,
  FicaData,
} from "../types";
import { calculateTaxByBrackets } from "../taxUtils";
import {
  calculatePaymentSummary,
  calculateSafeHarbor,
  calculateStateIncome,
} from "./stateCalcUtils";

/**
 * Colorado State Tax Calculator
 *
 * Colorado has a flat 4.4% income tax rate.
 * Colorado uses federal taxable income as the starting point, meaning:
 * - Federal standard/itemized deductions are already applied
 * - 401k and pre-tax medical are already deducted
 *
 * Colorado then adds back (DR 0104 lines 2 to 4):
 * - State income tax deducted on federal Schedule A
 * - Federal deductions above a small limit when AGI is $300,000 or more
 * and subtracts charitable contributions over $500 for non-itemizers.
 *
 * All capital gains are taxed as ordinary income at the flat rate.
 *
 * Safe harbor: 90% of current year tax OR 100% of prior year tax
 */
export function calculateColoradoTax(
  inputs: TaxInputs,
  coloradoBrackets: TaxBracketsData,
  sharedLimits: SharedLimitsData,
  coloradoLimits: ColoradoLimitsData,
  federal: TaxCalculationResult,
  ficaData?: FicaData,
): TaxCalculationResult {
  const { filingStatus } = inputs;

  // Interest, dividends, self-employment income, and all capital gains are
  // taxed as ordinary income (capital losses follow federal Schedule D rules).
  // AGI follows the federal above-the-line deductions.
  const {
    adjustedGrossIncome,
    deductibleSETax,
    grossIncome,
    interestIncome,
    longTermLossCarryoverOffset,
    ordinaryDividends,
    selfEmploymentIncome,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
    stateIncome,
  } = calculateStateIncome(inputs, sharedLimits, ficaData);

  // Colorado uses federal taxable income as the starting point
  const federalTaxableIncome = Math.max(
    0,
    federal.taxableOrdinaryIncome + federal.taxableLTCG,
  );
  const federalDeduction = federal.deductionBreakdown;
  const federalAgi = federal.adjustedGrossIncome;
  const isJoint = filingStatus === "marriedFilingJointly";

  // State income tax addback (itemizers): the state income tax deducted on
  // Schedule A, where property tax is treated as using the SALT cap first,
  // limited to the amount by which itemizing beat the standard deduction
  const stateIncomeTaxAddback =
    federalDeduction.deductionUsed === "itemized"
      ? Math.min(
          Math.max(
            0,
            federalDeduction.saltDeduction - inputs.propertyTaxesPaid,
          ),
          Math.max(
            0,
            federalDeduction.deductionAmount -
              federalDeduction.standardDeduction,
          ),
        )
      : 0;

  // High-income addback: federal deductions above the limit. It is reduced
  // by the state income tax addback, so the larger of the two applies.
  const { agiThreshold, limit } = coloradoLimits.deductionAddback;
  const highIncomeAddback =
    federalAgi >= agiThreshold
      ? Math.max(
          0,
          federalDeduction.deductionAmount -
            (isJoint ? limit.marriedFilingJointly : limit.default),
        )
      : 0;
  const deductionAddback = Math.max(stateIncomeTaxAddback, highIncomeAddback);

  // Charitable subtraction for taxpayers who take the federal standard
  // deduction
  const charitableSubtraction =
    federalDeduction.deductionUsed === "standard"
      ? Math.max(
          0,
          inputs.charitableContributions -
            coloradoLimits.charitableSubtractionFloor,
        )
      : 0;

  const taxableIncome = Math.max(
    0,
    federalTaxableIncome + deductionAddback - charitableSubtraction,
  );

  // Calculate tax using flat rate (single bracket)
  const ordinaryTax = calculateTaxByBrackets(
    taxableIncome,
    coloradoBrackets.brackets[filingStatus],
  );

  const totalTax = ordinaryTax.total;

  // Calculate remaining owed
  const { totalPaid, remainingOwed, refundDue } = calculatePaymentSummary(
    totalTax,
    inputs.stateTaxWithheld,
    inputs.stateEstimatedPaid,
  );

  // Calculate safe harbor
  const safeHarbor = calculateSafeHarbor(
    totalTax,
    totalPaid,
    inputs.priorYearStateTax,
    {
      currentYearPercent: coloradoLimits.safeHarbor.currentYearPercent,
      priorYearPercent: coloradoLimits.safeHarbor.priorYearPercent,
    },
  );

  // Create deduction breakdown (showing federal deductions used by CO)
  const emptyDeductionBreakdown: DeductionBreakdown = {
    standardDeduction: 0, // CO uses federal taxable income directly
    itemizedDeduction: 0,
    deductionUsed: "standard",
    deductionAmount: 0,
    saltDeduction: 0,
    saltCapped: false,
    mortgageInterest: 0,
    charitableContributions: 0,
  };

  return {
    wageIncome: stateIncome,
    shortTermCapitalGains: inputs.shortTermCapitalGains,
    longTermCapitalGains: inputs.longTermCapitalGains,
    interestIncome,
    ordinaryDividends,
    grossIncome,
    shortTermLossCarryoverOffset,
    shortTermLossCarryoverUnused,
    longTermLossCarryoverOffset,
    contributions401k: inputs.contributions401k,
    preTaxMedical: inputs.preTaxMedical,
    selfEmploymentIncome:
      selfEmploymentIncome > 0 ? selfEmploymentIncome : undefined,
    deductibleSETax: deductibleSETax > 0 ? deductibleSETax : undefined,
    adjustedGrossIncome,
    deductionBreakdown: emptyDeductionBreakdown,
    coloradoAdjustments: {
      charitableSubtraction,
      deductionAddback,
      federalTaxableIncome,
    },
    taxableOrdinaryIncome: taxableIncome,
    taxableLTCG: 0, // CO doesn't have separate LTCG treatment
    ordinaryIncomeBracketBreakdown: ordinaryTax.breakdown,
    ltcgBracketBreakdown: [],
    ordinaryIncomeTax: ordinaryTax.total,
    ltcgTax: 0,
    totalTax,
    withheld: inputs.stateTaxWithheld,
    estimatedPaid: inputs.stateEstimatedPaid,
    totalPaid,
    remainingOwed,
    refundDue,
    safeHarbor,
  };
}
