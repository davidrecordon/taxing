import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import {
  calculateCharitableScenario,
  calculateEstimate,
  calculateJointScenario,
  calculateMFSScenario,
} from "../calculate";
import { compareWithNoGiving } from "../charitableScenario";
import { SUPPORTED_YEARS, TAX_YEAR, TaxYear } from "../config";
import { STATE_LABELS, TaxInputs, TaxState } from "../types";
import { loadFederalData, loadStateDataSync } from "../taxData";
import { estimateWithholding } from "../withholdingEstimate";
import { DATA_STATUS } from "./dataStatus";
import {
  compareCharitableGivingInputSchema,
  compareFilingStatusInputSchema,
  estimateTaxInputSchema,
  estimateWithholdingInputSchema,
  noInputSchema,
  taxInputsSchema,
  toTaxInputs,
} from "./schemas";
import {
  describeAssumptions,
  describeData,
  describeNotes,
  describeWithholdingMethods,
  roundResult,
  summarizeJurisdiction,
  summarizeSafeHarbor,
} from "./summaries";

/**
 * The estimate.tax MCP server: the site's calculations as read-only tools
 * for AI assistants and other programs.
 *
 * Every tool is stateless. The caller sends the whole return in the call and
 * gets the result back; nothing is remembered between calls and nothing is
 * logged beyond the tool name and how long it took. The HTTP route
 * (`app/api/mcp/route.ts`) builds a fresh server per request, so this module
 * must stay stateless too.
 */

const MCP_SERVER_INFO = {
  name: "estimate.tax",
  version: "1.0.0",
} as const;

// A result as both JSON text (every client) and structured content
function toResult(result: unknown): CallToolResult {
  const rounded = roundResult(result);
  return {
    content: [{ type: "text", text: JSON.stringify(rounded, null, 2) }],
    structuredContent: rounded as Record<string, unknown>,
  };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

// Logs the tool name and duration, the only things the server records
function timed<Args>(
  toolName: string,
  run: (args: Args) => unknown,
): (args: Args) => CallToolResult {
  return (args) => {
    const startTime = Date.now();
    try {
      return toResult(run(args));
    } finally {
      console.log(`[MCP] tools/call ${toolName} - ${Date.now() - startTime}ms`);
    }
  };
}

// The year's data for the state in the inputs
function dataFor(inputs: TaxInputs) {
  return {
    federalData: loadFederalData(inputs.taxYear),
    stateData: loadStateDataSync(inputs.selectedState, inputs.taxYear),
  };
}

type StateCapabilities = {
  id: TaxState;
  label: string;
  incomeTax: "progressive" | "flat" | "none";
  capitalGains: "ordinary" | "ltcgOnly" | "none";
  withholdingEstimate: boolean;
  deductionChoiceCoupledToFederal: boolean;
  localTax: "nyc" | null;
};

const STATE_CAPABILITIES: StateCapabilities[] = [
  {
    id: "california",
    label: STATE_LABELS.california,
    incomeTax: "progressive",
    capitalGains: "ordinary",
    withholdingEstimate: true,
    deductionChoiceCoupledToFederal: false,
    localTax: null,
  },
  {
    id: "colorado",
    label: STATE_LABELS.colorado,
    incomeTax: "flat",
    capitalGains: "ordinary",
    withholdingEstimate: true,
    deductionChoiceCoupledToFederal: true,
    localTax: null,
  },
  {
    id: "dc",
    label: STATE_LABELS.dc,
    incomeTax: "progressive",
    capitalGains: "ordinary",
    withholdingEstimate: false,
    deductionChoiceCoupledToFederal: true,
    localTax: null,
  },
  {
    id: "florida",
    label: STATE_LABELS.florida,
    incomeTax: "none",
    capitalGains: "none",
    withholdingEstimate: false,
    deductionChoiceCoupledToFederal: false,
    localTax: null,
  },
  {
    id: "illinois",
    label: STATE_LABELS.illinois,
    incomeTax: "flat",
    capitalGains: "ordinary",
    withholdingEstimate: true,
    deductionChoiceCoupledToFederal: false,
    localTax: null,
  },
  {
    id: "newyork",
    label: STATE_LABELS.newyork,
    incomeTax: "progressive",
    capitalGains: "ordinary",
    withholdingEstimate: true,
    deductionChoiceCoupledToFederal: false,
    localTax: "nyc",
  },
  {
    id: "washington",
    label: STATE_LABELS.washington,
    incomeTax: "none",
    capitalGains: "ltcgOnly",
    withholdingEstimate: false,
    deductionChoiceCoupledToFederal: false,
    localTax: null,
  },
];

// Washington's 80% figure is a penalty threshold, not an installment rule
function currentYearPercent(inputs: TaxInputs, limits: unknown): number {
  const safeHarbor = (limits as { safeHarbor?: Record<string, number> })
    .safeHarbor;
  return safeHarbor?.currentYearPercent ?? safeHarbor?.percent ?? 0;
}

export function createTaxServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO);

  server.registerTool(
    "estimate_tax",
    {
      title: "Estimate Federal and State Tax",
      description:
        "Estimate a year's federal and state income tax from the return's figures: income, deductions, withholding and payments so far, and last year's tax. Returns both breakdowns with the amount owed or refund, the safe harbor test for underpayment penalties, the notes the site shows where a rule limited a figure, and what was assumed for any field left out. Supports California, Colorado, DC, Florida, Illinois, New York (with the city tax) and Washington (capital gains tax only), for tax years " +
        SUPPORTED_YEARS.join(" and ") +
        ". Stateless: send the whole return each call.",
      inputSchema: estimateTaxInputSchema,
      annotations: { readOnlyHint: true },
    },
    timed("estimate_tax", ({ detail, ...args }) => {
      const inputs = toTaxInputs(args);
      const { federalData, stateData } = dataFor(inputs);
      const estimate = calculateEstimate(inputs, federalData, stateData);
      const { federal, state } = estimate.results;
      const stateLabel = STATE_LABELS[inputs.selectedState];
      return {
        taxYear: inputs.taxYear,
        selectedState: inputs.selectedState,
        federal:
          detail === "full"
            ? federal
            : summarizeJurisdiction(
                federal,
                federalData.federalLimits.safeHarbor.currentYearPercent,
                true,
              ),
        state:
          detail === "full"
            ? state
            : summarizeJurisdiction(
                state,
                currentYearPercent(inputs, stateData.limits),
                false,
              ),
        notes: describeNotes(federal, state, stateLabel),
        assumptions: describeAssumptions(args, estimate),
        data: describeData(inputs.taxYear),
      };
    }),
  );

  server.registerTool(
    "check_safe_harbor",
    {
      title: "Check the Safe Harbor",
      description:
        "Whether withholding plus estimated payments reach the safe harbor that avoids an underpayment penalty, federally and for the state, and how much more is needed. The required amount is the lesser of a share of this year's tax (90% federally) and a share of last year's (100%, or 110% when last year's AGI was over $150,000); California drops the prior-year method at $1,000,000 of AGI. One annual comparison; the timing of individual installments is not modelled. Takes the same inputs as estimate_tax.",
      inputSchema: taxInputsSchema,
      annotations: { readOnlyHint: true },
    },
    timed("check_safe_harbor", (args) => {
      const inputs = toTaxInputs(args);
      const { federalData, stateData } = dataFor(inputs);
      const estimate = calculateEstimate(inputs, federalData, stateData);
      const { federal, state } = estimate.results;
      const paid = (result: typeof federal) => ({
        withheld: {
          amount: result.withheld,
          source: result.withheldEstimated ? "estimate" : "user_input",
        },
        estimatedPayments: { amount: result.estimatedPaid, source: "user_input" },
        total: result.totalPaid,
      });
      return {
        taxYear: inputs.taxYear,
        selectedState: inputs.selectedState,
        federal: {
          totalTax: federal.totalTax,
          ...summarizeSafeHarbor(
            federal,
            federalData.federalLimits.safeHarbor.currentYearPercent,
          ),
          paid: paid(federal),
        },
        state: state.safeHarbor
          ? {
              totalTax: state.totalTax,
              ...summarizeSafeHarbor(
                state,
                currentYearPercent(inputs, stateData.limits),
              ),
              paid: paid(state),
            }
          : null,
        note: "One annual comparison; the timing of individual installments is not modelled",
        assumptions: describeAssumptions(args, estimate),
        data: describeData(inputs.taxYear),
      };
    }),
  );

  server.registerTool(
    "compare_charitable_giving",
    {
      title: "Compare Charitable Giving",
      description:
        "What each of several amounts of charitable giving saves in federal and state tax compared with giving nothing, and what limits the deduction: whether the federal return itemizes, the 0.5% of AGI floor, and the high-income reductions. Takes the same inputs as estimate_tax plus the amounts to compare.",
      inputSchema: compareCharitableGivingInputSchema,
      annotations: { readOnlyHint: true },
    },
    timed("compare_charitable_giving", ({ contributions, ...args }) => {
      const inputs = toTaxInputs(args);
      const { federalData, stateData } = dataFor(inputs);
      const { resolvedInputs } = calculateEstimate(
        inputs,
        federalData,
        stateData,
      );
      const scenario = (amount: number) =>
        calculateCharitableScenario(
          resolvedInputs,
          amount,
          federalData,
          stateData,
        );
      const noGiving = scenario(0);
      return {
        taxYear: inputs.taxYear,
        selectedState: inputs.selectedState,
        noGiving: { federalTax: noGiving.federalTax, stateTax: noGiving.stateTax },
        scenarios: contributions.map((amount) => {
          const result = scenario(amount);
          return {
            contributions: amount,
            ...result,
            ...compareWithNoGiving(noGiving, result),
          };
        }),
        data: describeData(inputs.taxYear),
      };
    }),
  );

  server.registerTool(
    "compare_filing_status",
    {
      title: "Compare Joint and Separate Returns",
      description:
        "For a married couple: federal, state and combined tax on one joint return against two separate returns, dividing the joint figures between the spouses by the given split. Positive difference means separate returns cost more. The split applies the same percentage to every item in a category; community property rules and the rule that both spouses must itemize if one does are not modelled. Takes the same inputs as estimate_tax, with filingStatus marriedFilingJointly, plus the split.",
      inputSchema: compareFilingStatusInputSchema,
      annotations: { readOnlyHint: true },
    },
    ({ split, ...args }) => {
      if (args.filingStatus !== "marriedFilingJointly") {
        return toolError(
          "compare_filing_status is for a married couple: send filingStatus marriedFilingJointly with the couple's joint figures",
        );
      }
      return timed("compare_filing_status", () => {
        const inputs = toTaxInputs(args);
        const { federalData, stateData } = dataFor(inputs);
        const { resolvedInputs } = calculateEstimate(
          inputs,
          federalData,
          stateData,
        );
        const joint = calculateJointScenario(
          resolvedInputs,
          federalData,
          stateData,
        );
        const separate = calculateMFSScenario(
          resolvedInputs,
          split,
          federalData,
          stateData,
        );
        return {
          taxYear: inputs.taxYear,
          selectedState: inputs.selectedState,
          joint,
          separate,
          difference: {
            federalTax: separate.combined.federalTax - joint.federalTax,
            stateTax: separate.combined.stateTax - joint.stateTax,
            totalTax: separate.combined.totalTax - joint.totalTax,
          },
          note: "The split applies the same percentage to every item in a category; community property rules and the both-must-itemize rule are not modelled",
          data: describeData(inputs.taxYear),
        };
      })(undefined);
    },
  );

  server.registerTool(
    "estimate_withholding",
    {
      title: "Estimate Withholding",
      description:
        "What an employer would withhold over the year on these wages: federal, and the state's where it is modelled (California, Colorado, Illinois, New York; null for DC, Florida and Washington). Regular wages follow the annual withholding schedules for a W-4 with no adjustments; bonuses and stock use the flat supplemental rates. This is what estimate_tax uses when withholding is not entered.",
      inputSchema: estimateWithholdingInputSchema,
      annotations: { readOnlyHint: true },
    },
    timed("estimate_withholding", (args) => {
      const inputs = toTaxInputs(args);
      const { federalData, stateData } = dataFor(inputs);
      const estimate = estimateWithholding(inputs, federalData, stateData);
      return {
        taxYear: inputs.taxYear,
        selectedState: inputs.selectedState,
        ...estimate,
        method: describeWithholdingMethods(inputs, estimate),
        data: describeData(inputs.taxYear),
      };
    }),
  );

  server.registerTool(
    "list_jurisdictions",
    {
      title: "List Supported States and Years",
      description:
        "The tax years and states estimate.tax supports, what each state's calculation covers, and the date the data was verified against official sources with any figures still awaiting publication.",
      inputSchema: noInputSchema,
      annotations: { readOnlyHint: true },
    },
    timed("list_jurisdictions", () => ({
      years: SUPPORTED_YEARS,
      defaultYear: TAX_YEAR,
      states: STATE_CAPABILITIES,
      data: Object.fromEntries(
        SUPPORTED_YEARS.map((year: TaxYear) => [year, DATA_STATUS[year]]),
      ),
    })),
  );

  return server;
}
