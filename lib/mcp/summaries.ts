import { Estimate } from "../calculate";
import { TaxYear } from "../config";
import { spouseWages } from "../earners";
import { formatCurrency } from "../formatters";
import { STATE_LABELS, TaxCalculationResult, TaxInputs } from "../types";
import { WithholdingEstimate } from "../withholdingEstimate";
import { DATA_STATUS, DataStatus } from "./dataStatus";
import { TaxInputsArgs } from "./schemas";

/**
 * The shapes the MCP tools return: a compact summary of each breakdown, the
 * notes the page shows next to a limited figure, and what the calculation
 * assumed where the caller left a field out.
 */

const CENTS = 100;
const RATE_PLACES = 1e6;
// Keys holding a rate rather than an amount
const RATE_KEY = /rate|percent/i;

/**
 * Round every amount in a result to cents and every rate to six places. The
 * calculators work in floating point, and a caller should not see
 * 99000.00000000001.
 */
export function roundResult<T>(value: T, key = ""): T {
  if (typeof value === "number") {
    const places = RATE_KEY.test(key) ? RATE_PLACES : CENTS;
    return (Math.round(value * places) / places) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => roundResult(item, key)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        roundResult(v, k),
      ]),
    ) as T;
  }
  return value;
}

export type Source = "user_input" | "estimate" | "default";

export interface Assumption {
  field: keyof TaxInputs;
  value: number | boolean;
  source: Source;
  reason: string;
}

export interface SafeHarborSummary {
  required: number;
  method: "currentYear" | "priorYear";
  met: boolean;
  remaining: number;
  currentYearShare: { percent: number; amount: number };
  priorYearShare: { percent: number; amount: number; available: boolean } | null;
  highIncomeException?: boolean;
}

export interface JurisdictionSummary {
  adjustedGrossIncome: number;
  deductionUsed: "standard" | "itemized";
  deductionAmount: number;
  taxableOrdinaryIncome: number;
  taxableLTCG: number;
  ordinaryIncomeTax: number;
  ltcgTax: number;
  niit?: number;
  selfEmploymentTax?: number;
  additionalMedicareTaxOnWages?: number;
  additionalMedicareTaxOnSelfEmployment?: number;
  qbiDeduction?: number;
  taxCredits?: number;
  caMentalHealthTax?: number;
  nycTax?: number;
  nycSchoolTaxCredit?: number;
  nyTaxBenefitRecapture?: number;
  propertyTaxCredit?: number;
  totalTax: number;
  effectiveRateOnGrossIncome: number;
  withheld: number;
  withheldSource: Source;
  additionalMedicareWithheld?: number;
  estimatedPaid: number;
  totalPaid: number;
  remainingOwed: number;
  refundDue: number;
  safeHarbor: SafeHarborSummary | null;
  payrollTax?: {
    socialSecurity: number;
    medicare: number;
    additionalMedicare: number;
    additionalMedicareWithheld: number;
    total: number;
    note: string;
  };
}

const PAYROLL_NOTE =
  "Social Security and Medicare are withheld by employers and not part of the tax owed. Additional Medicare is in totalTax, and additionalMedicareWithheld (0.9% of each earner's wages over $200,000) is credited in totalPaid";

export function summarizeSafeHarbor(
  result: TaxCalculationResult,
  currentYearPercent: number,
): SafeHarborSummary | null {
  const safeHarbor = result.safeHarbor;
  if (!safeHarbor) {
    return null;
  }
  const priorYearAvailable =
    safeHarbor.priorYearSafeHarbor > 0 && !safeHarbor.highIncomeException;
  return {
    required: safeHarbor.minimum,
    method:
      priorYearAvailable && safeHarbor.minimum < safeHarbor.currentYear90Percent
        ? "priorYear"
        : "currentYear",
    met: safeHarbor.met,
    remaining: safeHarbor.remaining,
    currentYearShare: {
      percent: currentYearPercent,
      amount: safeHarbor.currentYear90Percent,
    },
    priorYearShare:
      safeHarbor.priorYearPercent === undefined
        ? null
        : {
            percent: safeHarbor.priorYearPercent,
            amount: safeHarbor.priorYearSafeHarbor,
            available: priorYearAvailable,
          },
    ...(safeHarbor.highIncomeException !== undefined && {
      highIncomeException: safeHarbor.highIncomeException,
    }),
  };
}

// A figure worth reporting, or undefined so it is left out
function positive(value: number | undefined): number | undefined {
  return value && value > 0 ? value : undefined;
}

function defined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export function summarizeJurisdiction(
  result: TaxCalculationResult,
  currentYearPercent: number,
  isFederal: boolean,
): JurisdictionSummary {
  const se = result.selfEmploymentTaxBreakdown;
  const fica = result.ficaBreakdown;
  return {
    adjustedGrossIncome: result.adjustedGrossIncome,
    deductionUsed: result.deductionBreakdown.deductionUsed,
    deductionAmount: result.deductionBreakdown.deductionAmount,
    taxableOrdinaryIncome: result.taxableOrdinaryIncome,
    taxableLTCG: result.taxableLTCG,
    ordinaryIncomeTax: result.ordinaryIncomeTax,
    ltcgTax: result.ltcgTax,
    ...defined({
      niit: result.niitBreakdown?.tax,
      selfEmploymentTax: se?.totalSETax,
      additionalMedicareTaxOnWages: positive(fica?.additionalMedicareTax),
      additionalMedicareTaxOnSelfEmployment: se?.additionalMedicareTax,
      qbiDeduction: result.qbiDeduction?.finalDeduction,
      taxCredits: result.taxCredits,
      caMentalHealthTax: result.caMentalHealthTax,
      nycTax: result.nycTax,
      nycSchoolTaxCredit: result.nycSchoolTaxCredit,
      nyTaxBenefitRecapture: result.nyTaxBenefitRecapture,
      propertyTaxCredit: result.propertyTaxCredit,
    }),
    totalTax: result.totalTax,
    effectiveRateOnGrossIncome:
      result.grossIncome > 0 ? result.totalTax / result.grossIncome : 0,
    withheld: result.withheld,
    withheldSource: result.withheldEstimated ? "estimate" : "user_input",
    ...defined({ additionalMedicareWithheld: result.additionalMedicareWithheld }),
    estimatedPaid: result.estimatedPaid,
    totalPaid: result.totalPaid,
    remainingOwed: result.remainingOwed,
    refundDue: result.refundDue,
    safeHarbor: summarizeSafeHarbor(result, currentYearPercent),
    ...(isFederal &&
      fica && {
        payrollTax: {
          socialSecurity: fica.socialSecurityTax,
          medicare: fica.medicareTax,
          additionalMedicare: fica.additionalMedicareTax,
          additionalMedicareWithheld: fica.additionalMedicareWithheld,
          total: fica.totalFica,
          note: PAYROLL_NOTE,
        },
      }),
  };
}

/**
 * The sentences the page shows next to a figure a rule has limited or
 * changed, in the same plain terms, so a caller can show them unchanged.
 */
export function describeNotes(
  federal: TaxCalculationResult,
  state: TaxCalculationResult,
  stateLabel: string,
  inputs: TaxInputs,
): string[] {
  const notes: string[] = [];
  const fd = federal.deductionBreakdown;
  const sd = state.deductionBreakdown;
  const fica = federal.ficaBreakdown;

  if ((federal.taxCredits ?? 0) < inputs.federalTaxCredits) {
    notes.push(
      `Federal: tax credits limited to the ${formatCurrency(federal.taxCredits ?? 0)} of income tax; they do not reduce self-employment tax, NIIT or Additional Medicare`,
    );
  }
  if (
    fica &&
    Math.round(fica.additionalMedicareTax * 100) !==
      Math.round(fica.additionalMedicareWithheld * 100)
  ) {
    notes.push(
      `Federal: employers withhold ${formatCurrency(fica.additionalMedicareWithheld)} toward the ${formatCurrency(fica.additionalMedicareTax)} of Additional Medicare tax, since the surtax is withheld above $200,000 of each earner's wages whatever the filing status`,
    );
  }

  if (fd.chosenForStateTax) {
    notes.push(
      `Federal: the ${fd.deductionUsed} deduction is taken, although the other is larger, because it lowers Federal and ${stateLabel} tax combined`,
    );
  }
  if (fd.saltCapped) {
    notes.push("Federal: state and local tax deduction limited by the SALT cap");
  }
  if (fd.charitableFloorReduction) {
    notes.push(
      `Federal: ${formatCurrency(fd.charitableFloorReduction)} of charitable giving is under the floor of 0.5% of AGI and not deducted`,
    );
  }
  if (fd.highIncomeReduction) {
    notes.push(
      `Federal: itemized deductions reduced by ${formatCurrency(fd.highIncomeReduction)} for income over the limit`,
    );
  }
  if (sd.highIncomeReduction) {
    notes.push(
      `${stateLabel}: itemized deductions reduced by ${formatCurrency(sd.highIncomeReduction)} for income over the limit`,
    );
  }
  if (sd.followsFederalChoice) {
    notes.push(
      `${stateLabel}: takes the same type of deduction as the Federal return`,
    );
  }
  if (state.safeHarbor?.highIncomeException) {
    notes.push(
      `${stateLabel}: the prior-year safe harbor is not available at this income, so 90% of this year's tax is required`,
    );
  }
  return notes;
}

/**
 * What the calculation filled in for a field the caller left out, in the
 * vocabulary pf uses for its own facts, so a consumer can show the gap.
 */
export function describeAssumptions(
  args: TaxInputsArgs,
  estimate: Estimate,
): Assumption[] {
  const assumptions: Assumption[] = [];
  const { results, withholdingEstimate } = estimate;

  if (results.federal.withheldEstimated) {
    assumptions.push({
      field: "federalTaxWithheld",
      value: withholdingEstimate.federal,
      source: "estimate",
      reason:
        "Not entered; estimated from wages the way an employer would withhold",
    });
  }
  if (results.state.withheldEstimated) {
    assumptions.push({
      field: "stateTaxWithheld",
      value: withholdingEstimate.state ?? 0,
      source: "estimate",
      reason:
        "Not entered; estimated from wages the way an employer would withhold",
    });
  }
  if (
    args.priorYearIncomeOverThreshold === undefined &&
    (args.priorYearFederalTax > 0 || args.priorYearStateTax > 0)
  ) {
    assumptions.push({
      field: "priorYearIncomeOverThreshold",
      value: true,
      source: "default",
      reason:
        "Not entered; treated as over $150,000, so 110% of last year's tax is the prior-year safe harbor",
    });
  }
  if (
    args.filingStatus === "marriedFilingJointly" &&
    args.federalIncome > 0 &&
    spouseWages(args) === 0
  ) {
    assumptions.push({
      field: "spouseWages",
      value: 0,
      source: "default",
      reason:
        "Not entered; all wages treated as one earner's for the withholding estimate, the Social Security wage base and Additional Medicare withholding",
    });
  }
  if (args.stateIncome === 0 && args.federalIncome > 0) {
    assumptions.push({
      field: "stateIncome",
      value: args.federalIncome,
      source: "default",
      reason: "Not entered; state wages taken as equal to federal wages",
    });
  }
  return assumptions;
}

export function describeData(taxYear: TaxYear): { year: TaxYear } & DataStatus {
  return { year: taxYear, ...DATA_STATUS[taxYear] };
}

export function stateLabelFor(inputs: Pick<TaxInputs, "selectedState">) {
  return STATE_LABELS[inputs.selectedState];
}

// One sentence per jurisdiction on how the withholding estimate was made
export function describeWithholdingMethods(
  inputs: TaxInputs,
  estimate: WithholdingEstimate,
): { federal: string; state: string | null } {
  const earners =
    spouseWages(inputs) > 0
      ? "Each earner's wages separately, as their own employer would: "
      : "";
  const federal =
    earners +
    "Regular wages by the annual percentage method for a W-4 with no adjustments, after pre-tax deductions and the standard deduction; bonuses and stock at the flat supplemental rate (22%, 37% above $1,000,000 in the year)";
  const stateMethods: Partial<Record<TaxInputs["selectedState"], string>> = {
    california:
      "Regular wages by EDD Method B; bonuses and stock at the 10.23% supplemental rate",
    colorado:
      "All wages at the flat rate less the employer worksheet's standard allowance",
    illinois:
      "All wages at the flat rate less the assumed IL-W-4 allowances",
    newyork:
      "Regular wages by the Method II annual schedule (Method III above its threshold); bonuses and stock at the 11.70% supplemental rate, plus the city's schedule and 4.25% for a city resident",
  };
  return {
    federal,
    state:
      estimate.state === null
        ? null
        : (stateMethods[inputs.selectedState] ?? null),
  };
}
