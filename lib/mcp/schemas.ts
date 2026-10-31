import { z } from "zod";
import { SUPPORTED_YEARS, TAX_YEAR } from "../config";
import { DEFAULT_TAX_INPUTS } from "../defaultInputs";
import { SplitConfig } from "../spouseInputs";
import { TaxInputs } from "../types";

/**
 * Tool input schemas. The Zod objects are the single source of truth: the
 * MCP SDK validates `tools/call` arguments against them and derives the JSON
 * Schema advertised by `tools/list` from them, so the `.describe()` text is
 * what an AI assistant reads. Field names mirror `TaxInputs` in `lib/types.ts`.
 *
 * Unlike the on-screen text, these descriptions may name tax forms and boxes:
 * the reader is a model mapping a person's documents onto fields.
 */

// Amounts are dollars for the year. The ceiling keeps arithmetic sane and
// rejects obvious garbage; nobody's wages are a trillion dollars.
const MAX_AMOUNT = 1e12;
const amount = (description: string) =>
  z.number().min(0).max(MAX_AMOUNT).default(0).describe(description);
// Capital gains may be negative (a loss)
const signedAmount = (description: string) =>
  z
    .number()
    .min(-MAX_AMOUNT)
    .max(MAX_AMOUNT)
    .default(0)
    .describe(description);

export const filingStatusSchema = z
  .enum(["single", "marriedFilingJointly", "marriedFilingSeparately"])
  .describe("Filing status");

export const stateSchema = z
  .enum([
    "california",
    "colorado",
    "dc",
    "florida",
    "illinois",
    "newyork",
    "washington",
  ])
  .describe("The state (or DC) whose tax to estimate alongside federal");

export const taxYearSchema = z
  .enum(SUPPORTED_YEARS)
  .default(TAX_YEAR)
  .describe(`Tax year; ${TAX_YEAR} unless given`);

/**
 * Everything the calculator takes. Every amount defaults to 0 except the
 * three fields that choose the rules, so a caller sends only what it knows.
 */
export const taxInputsSchema = z
  .object({
    taxYear: taxYearSchema,
    filingStatus: filingStatusSchema,
    selectedState: stateSchema,
    isNYCResident: z
      .boolean()
      .default(false)
      .describe("New York City resident (adds the city tax); New York only"),

    federalIncome: amount(
      "Wages and salary for the year, before pre-tax deductions (W-2 box 1 plus 401(k) and pre-tax medical)",
    ),
    stateIncome: amount(
      "Wages taxed by the state when they differ from federal wages; 0 means the same",
    ),
    supplementalWages: amount(
      "The part of wages paid as bonuses or stock; affects only the withholding estimate, not the tax",
    ),
    spouseWages: amount(
      "Married filing jointly only: the part of federalIncome earned by the spouse (their W-2 wages). Divides the wages between two earners for the withholding estimate, the Social Security wage base and the Additional Medicare tax withheld (0.9% of each earner's wages over $200,000, Form 8959 Part V); income tax is on the combined wages either way. Omit for one earner, which is reported as an assumption",
    ),
    selfEmploymentIncome: amount(
      "Net profit from self-employment (Schedule C); self-employment tax, the QBI deduction and Additional Medicare tax follow from it. On a joint return the business is treated as the first earner's (not the spouse's), for the Social Security wage base",
    ),
    shortTermCapitalGains: signedAmount(
      "Net short-term capital gain, or a loss as a negative number",
    ),
    longTermCapitalGains: signedAmount(
      "Net long-term capital gain, or a loss as a negative number",
    ),
    interestIncome: amount("Taxable interest (1099-INT box 1)"),
    treasuryInterest: amount(
      "The part of interestIncome from U.S. Treasuries, exempt from state tax",
    ),
    ordinaryDividends: amount(
      "Total dividends (1099-DIV box 1a), including the qualified part",
    ),
    qualifiedDividends: amount(
      "The qualified part of ordinaryDividends (1099-DIV box 1b)",
    ),

    contributions401k: amount("Pre-tax 401(k) contributions"),
    preTaxMedical: amount(
      "Pre-tax medical, dental and similar payroll deductions",
    ),
    propertyTaxesPaid: amount("Property tax paid in the year"),
    mortgageInterestPaid: amount("Mortgage interest paid in the year"),
    mortgageBalance: amount(
      "Average mortgage balance, for the deduction limit on interest",
    ),
    isMortgageGrandfathered: z
      .boolean()
      .default(false)
      .describe(
        "Mortgage taken out on or before December 15, 2017, which keeps the $1,000,000 interest limit",
      ),
    charitableContributions: amount("Charitable giving for the year"),

    federalTaxWithheld: amount(
      "Federal income tax withheld for the full year (W-2 box 2), not Social Security or Medicare. Do not add Additional Medicare tax withheld (Form 8959 line 24): it is estimated from each earner's wages and credited separately. Omit, or send 0, to have the income tax withholding estimated from wages the way an employer would withhold; the response says when that happened",
    ),
    stateTaxWithheld: amount(
      "State income tax withheld for the full year. Omit, or send 0, to have it estimated where the state's withholding is modelled",
    ),
    federalEstimatedPaid: amount("Federal estimated tax payments made"),
    stateEstimatedPaid: amount("State estimated tax payments made"),
    federalTaxCredits: amount(
      "Nonrefundable federal credits expected for the year, such as the foreign tax credit (Form 1116, or 1099-DIV box 7 when under the $300/$600 limit) and the child tax credit, as one total. Taken off income tax only (Form 1040 line 22), not self-employment tax, NIIT or Additional Medicare; the response notes when the credits exceeded the income tax",
    ),

    priorYearFederalTax: amount(
      "Last year's total federal tax (Form 1040 line 24). 0 means unknown, which disables the prior-year safe harbor",
    ),
    priorYearStateTax: amount(
      "Last year's total state tax. 0 means unknown, which disables the state's prior-year safe harbor",
    ),
    priorYearStateBalancePaid: amount(
      "State tax for last year paid this year with last year's return; part of this year's federal SALT deduction",
    ),
    priorYearIncomeOverThreshold: z
      .boolean()
      .optional()
      .describe(
        "Whether last year's AGI was over $150,000 ($75,000 married filing separately), which raises the prior-year safe harbor to 110%. Omit when unknown; treated as over and reported as an assumption",
      ),
    priorYearShortTermLossCarryover: amount(
      "Short-term capital loss carried over from last year, as a positive number",
    ),
    priorYearLongTermLossCarryover: amount(
      "Long-term capital loss carried over from last year, as a positive number",
    ),
  })
  .strict();

export type TaxInputsArgs = z.infer<typeof taxInputsSchema>;

// The parsed arguments as the calculators take them
export function toTaxInputs(args: Partial<TaxInputsArgs>): TaxInputs {
  return { ...DEFAULT_TAX_INPUTS, ...args };
}

export const detailSchema = z
  .enum(["summary", "full"])
  .default("summary")
  .describe(
    "summary: the figures a person would ask about. full: every line of both breakdowns, including tax by bracket",
  );

export const estimateTaxInputSchema = taxInputsSchema.extend({
  detail: detailSchema,
});

export const MAX_CONTRIBUTION_SCENARIOS = 12;

export const compareCharitableGivingInputSchema = taxInputsSchema.extend({
  contributions: z
    .array(z.number().min(0).max(MAX_AMOUNT))
    .min(1)
    .max(MAX_CONTRIBUTION_SCENARIOS)
    .describe(
      "Amounts of charitable giving to compare with giving nothing, each replacing charitableContributions",
    ),
});

const percent = (description: string) =>
  z.number().min(0).max(100).default(50).describe(description);

export const splitSchema = z
  .object({
    wages: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe(
        "Spouse 1's share of wages and self-employment income. When omitted it follows spouseWages, or is 50",
      ),
    stcg: percent("Spouse 1's share of short-term capital gains"),
    ltcg: percent("Spouse 1's share of long-term capital gains"),
    dividends: percent("Spouse 1's share of interest and dividends"),
    contributions401k: percent("Spouse 1's share of 401(k) contributions"),
    preTaxMedical: percent("Spouse 1's share of pre-tax medical"),
    deductions: percent(
      "Spouse 1's share of property tax, mortgage interest and charitable giving",
    ),
  })
  .strict()
  .default({
    stcg: 50,
    ltcg: 50,
    dividends: 50,
    contributions401k: 50,
    preTaxMedical: 50,
    deductions: 50,
  })
  .describe(
    "How the joint figures divide between the spouses on separate returns, as spouse 1's percentage of each; spouse 2 gets the remainder. 50/50 unless given, except wages, which follow spouseWages when that was sent",
  ) satisfies z.ZodType<Omit<SplitConfig, "wages"> & { wages?: number }, unknown>;

export const compareFilingStatusInputSchema = taxInputsSchema.extend({
  split: splitSchema,
});

export const estimateWithholdingInputSchema = taxInputsSchema
  .pick({
    taxYear: true,
    filingStatus: true,
    selectedState: true,
    isNYCResident: true,
    federalIncome: true,
    stateIncome: true,
    supplementalWages: true,
    spouseWages: true,
    contributions401k: true,
    preTaxMedical: true,
  })
  .strict();

export const noInputSchema = z.object({}).strict();
