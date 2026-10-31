// Drives the MCP endpoint with the official client over Streamable HTTP and
// checks every tool across every state and year against lib/ directly.
// Run from the repo root: bun run <this file> [url]
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { calculateEstimate } from "@/lib/calculate";
import { SUPPORTED_YEARS, TaxYear } from "@/lib/config";
import { loadFederalData, loadStateDataSync } from "@/lib/taxData";
import { createDefaultInputs } from "@/lib/__tests__/testData";
import { FilingStatus, TaxState } from "@/lib/types";

const url = new URL(process.argv[2] ?? "http://localhost:3457/api/mcp");
const STATES: TaxState[] = [
  "california",
  "colorado",
  "dc",
  "florida",
  "illinois",
  "newyork",
  "washington",
];
const STATUSES: FilingStatus[] = [
  "single",
  "marriedFilingJointly",
  "marriedFilingSeparately",
];
const cents = (n: number) => Math.round(n * 100) / 100;

let failures = 0;
let checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) {
    failures++;
    console.log(`FAIL ${label} ${detail}`);
  }
}

type ToolResult = {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
  content: { type: string; text?: string }[];
};

async function main() {
  const client = new Client({ name: "exercise", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(url);
  await client.connect(transport);
  console.log(
    "connected; server:",
    JSON.stringify(client.getServerVersion()),
    "protocol:",
    transport.protocolVersion,
  );

  const call = async (name: string, args: Record<string, unknown>) =>
    (await client.callTool({ name, arguments: args })) as ToolResult;

  // tools/list
  const { tools } = await client.listTools();
  check("six tools", tools.length === 6, String(tools.length));
  for (const tool of tools) {
    check(`${tool.name} read-only`, tool.annotations?.readOnlyHint === true);
    check(
      `${tool.name} strict schema`,
      (tool.inputSchema as { additionalProperties?: boolean })
        .additionalProperties === false,
    );
  }

  // estimate_tax: every state, year and status, summary and full, against lib
  const profile = {
    federalIncome: 350000,
    supplementalWages: 80000,
    spouseWages: 120000, // Ignored except on the joint returns
    selfEmploymentIncome: 40000,
    shortTermCapitalGains: -5000,
    longTermCapitalGains: 120000,
    interestIncome: 6000,
    treasuryInterest: 2000,
    ordinaryDividends: 15000,
    qualifiedDividends: 12000,
    contributions401k: 23500,
    preTaxMedical: 4000,
    propertyTaxesPaid: 18000,
    mortgageInterestPaid: 32000,
    mortgageBalance: 950000,
    charitableContributions: 25000,
    federalEstimatedPaid: 10000,
    stateEstimatedPaid: 3000,
    federalTaxCredits: 1500,
    priorYearFederalTax: 80000,
    priorYearStateTax: 25000,
    priorYearStateBalancePaid: 2000,
    priorYearShortTermLossCarryover: 3000,
    priorYearLongTermLossCarryover: 1000,
  };
  for (const taxYear of SUPPORTED_YEARS as readonly TaxYear[]) {
    for (const selectedState of STATES) {
      for (const filingStatus of STATUSES) {
        const args = {
          ...profile,
          taxYear,
          selectedState,
          filingStatus,
          isNYCResident: selectedState === "newyork",
        };
        const label = `estimate_tax ${taxYear} ${selectedState} ${filingStatus}`;
        const summary = await call("estimate_tax", args);
        check(`${label} ok`, !summary.isError, summary.content[0]?.text);
        if (summary.isError) continue;
        const got = summary.structuredContent as {
          federal: { totalTax: number; remainingOwed: number; safeHarbor: unknown };
          state: { totalTax: number; remainingOwed: number };
          assumptions: { field: string }[];
          data: { year: string };
        };
        const expected = calculateEstimate(
          createDefaultInputs(args),
          loadFederalData(taxYear),
          loadStateDataSync(selectedState, taxYear),
        ).results;
        check(
          `${label} federal total`,
          got.federal.totalTax === cents(expected.federal.totalTax),
          `${got.federal.totalTax} vs ${expected.federal.totalTax}`,
        );
        check(
          `${label} state total`,
          got.state.totalTax === cents(expected.state.totalTax),
          `${got.state.totalTax} vs ${expected.state.totalTax}`,
        );
        check(
          `${label} state owed`,
          got.state.remainingOwed === cents(expected.state.remainingOwed),
        );
        check(`${label} data year`, got.data.year === taxYear);
        check(
          `${label} text matches structured`,
          JSON.stringify(JSON.parse(summary.content[0].text ?? "")) ===
            JSON.stringify(got),
        );

        const full = await call("estimate_tax", { ...args, detail: "full" });
        const fullGot = full.structuredContent as {
          federal: { totalTax: number; ordinaryIncomeBracketBreakdown: unknown[] };
          state: { deductionBreakdown: unknown };
        };
        check(`${label} full ok`, !full.isError);
        check(
          `${label} full total`,
          fullGot.federal.totalTax === cents(expected.federal.totalTax),
        );
        check(
          `${label} full brackets`,
          Array.isArray(fullGot.federal.ordinaryIncomeBracketBreakdown),
        );
      }
    }
  }

  // check_safe_harbor on every state
  for (const selectedState of STATES) {
    const r = await call("check_safe_harbor", {
      ...profile,
      selectedState,
      filingStatus: "single",
    });
    check(`check_safe_harbor ${selectedState}`, !r.isError, r.content[0]?.text);
    const sc = r.structuredContent as {
      federal: { required: number; method: string; remaining: number };
      state: null | { required: number; method: string; remaining: number };
    };
    check(`check_safe_harbor ${selectedState} federal`, sc.federal.required > 0);
    check(
      `check_safe_harbor ${selectedState} state side`,
      selectedState === "florida" ? sc.state === null : sc.state !== null,
    );
  }

  // compare_charitable_giving on every state, including a zero and a huge gift
  for (const selectedState of STATES) {
    const r = await call("compare_charitable_giving", {
      ...profile,
      selectedState,
      filingStatus: "marriedFilingJointly",
      contributions: [0, 5000, 50000, 500000],
    });
    check(`compare_charitable_giving ${selectedState}`, !r.isError, r.content[0]?.text);
    const sc = r.structuredContent as {
      scenarios: { contributions: number; totalSaved: number; federalSaved: number; stateSaved: number }[];
    };
    check(
      `compare_charitable_giving ${selectedState} zero saves nothing`,
      sc.scenarios[0].totalSaved === 0,
    );
    check(
      `compare_charitable_giving ${selectedState} monotone`,
      sc.scenarios[3].totalSaved >= sc.scenarios[2].totalSaved,
      JSON.stringify(sc.scenarios.map((s) => s.totalSaved)),
    );
  }

  // compare_filing_status on every state with an uneven split
  for (const selectedState of STATES) {
    const r = await call("compare_filing_status", {
      ...profile,
      selectedState,
      filingStatus: "marriedFilingJointly",
      split: { wages: 100, ltcg: 0 },
    });
    check(`compare_filing_status ${selectedState}`, !r.isError, r.content[0]?.text);
    const sc = r.structuredContent as {
      joint: { totalTax: number };
      separate: { combined: { totalTax: number } };
      difference: { totalTax: number };
    };
    check(
      `compare_filing_status ${selectedState} difference`,
      cents(sc.separate.combined.totalTax - sc.joint.totalTax) ===
        sc.difference.totalTax,
    );
  }

  // estimate_withholding on every state
  for (const selectedState of STATES) {
    const r = await call("estimate_withholding", {
      selectedState,
      filingStatus: "single",
      federalIncome: 300000,
      supplementalWages: 50000,
      isNYCResident: true,
    });
    check(`estimate_withholding ${selectedState}`, !r.isError, r.content[0]?.text);
    const sc = r.structuredContent as { federal: number; state: number | null };
    check(`estimate_withholding ${selectedState} federal`, sc.federal > 0);
    const modelled = ["california", "colorado", "illinois", "newyork"];
    check(
      `estimate_withholding ${selectedState} state ${modelled.includes(selectedState) ? "modelled" : "null"}`,
      modelled.includes(selectedState) ? (sc.state ?? 0) > 0 : sc.state === null,
    );
  }

  // list_jurisdictions
  const lj = await call("list_jurisdictions", {});
  check("list_jurisdictions", !lj.isError);
  check(
    "list_jurisdictions years",
    JSON.stringify((lj.structuredContent as { years: string[] }).years) ===
      JSON.stringify(SUPPORTED_YEARS),
  );

  // Edge cases
  const zero = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "washington",
  });
  check("all-zero return ok", !zero.isError);
  const z = zero.structuredContent as { federal: { totalTax: number; effectiveRateOnGrossIncome: number } };
  check("all-zero total 0", z.federal.totalTax === 0 && z.federal.effectiveRateOnGrossIncome === 0);

  const loss = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "california",
    federalIncome: 100000,
    shortTermCapitalGains: -50000,
    longTermCapitalGains: -20000,
  });
  check("net loss return ok", !loss.isError);

  const big = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "newyork",
    isNYCResident: true,
    federalIncome: 50_000_000,
    longTermCapitalGains: 200_000_000,
  });
  check("very large return ok", !big.isError);

  const tooBig = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "newyork",
    federalIncome: 1e13,
  });
  check("absurd amount rejected", tooBig.isError === true);

  const badYear = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "california",
    taxYear: "2024",
  });
  check("unsupported year rejected", badYear.isError === true, badYear.content[0]?.text);

  const badState = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "texas",
  });
  check("unsupported state rejected", badState.isError === true);

  const identity = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "california",
    name: "Someone",
  });
  check("identity field rejected", identity.isError === true);
  check(
    "identity value not echoed",
    !(identity.content[0]?.text ?? "").includes("Someone"),
    identity.content[0]?.text,
  );

  const stringAmount = await call("estimate_tax", {
    filingStatus: "single",
    selectedState: "california",
    federalIncome: "100000",
  });
  check("string amount rejected", stringAmount.isError === true);

  const mfsCompare = await call("compare_filing_status", {
    filingStatus: "marriedFilingSeparately",
    selectedState: "california",
    federalIncome: 100000,
  });
  check("compare_filing_status needs MFJ", mfsCompare.isError === true);

  let threw = false;
  try {
    await client.callTool({ name: "no_such_tool", arguments: {} });
  } catch {
    threw = true;
  }
  check("unknown tool is a protocol error", threw);

  await client.close();
  console.log(`\n${checks} checks, ${failures} failures`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("exercise failed:", error);
  process.exit(2);
});
