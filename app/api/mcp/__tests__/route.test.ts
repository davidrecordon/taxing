/**
 * Integration tests for the MCP route.
 *
 * Drives the route with real Streamable HTTP requests and asserts on the
 * JSON-RPC responses the MCP SDK produces. The calculations run for real;
 * the figures are checked against the calculators, not hand-computed, since
 * the calculators' own tests own the arithmetic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateEstimate } from "@/lib/calculate";
import { TAX_YEAR } from "@/lib/config";
import { clearRateLimits } from "@/lib/rateLimiter";
import { loadFederalData, loadStateDataSync } from "@/lib/taxData";
import { createDefaultInputs } from "@/lib/__tests__/testData";
import { DELETE, GET, OPTIONS, POST, RATE_LIMIT } from "../route";

const MCP_ACCEPT = "application/json, text/event-stream";

function createMcpRequest(
  body: object | string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: MCP_ACCEPT,
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

interface JsonRpcEnvelope {
  jsonrpc: "2.0";
  id?: string | number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any;
  error?: { code: number; message: string };
}

// A JSON-RPC response body, whether delivered as JSON or as an SSE stream
async function readJsonRpc(response: Response): Promise<JsonRpcEnvelope> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    return JSON.parse(text);
  }
  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim());
  return JSON.parse(dataLines[dataLines.length - 1]);
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<JsonRpcEnvelope> {
  const response = await POST(
    createMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  );
  return readJsonRpc(response);
}

// The worked example from the design: a single California filer with
// round, synthetic figures
const EXAMPLE = {
  filingStatus: "single",
  selectedState: "california",
  federalIncome: 400000,
  supplementalWages: 100000,
  longTermCapitalGains: 50000,
  ordinaryDividends: 10000,
  qualifiedDividends: 8000,
  interestIncome: 5000,
  contributions401k: 24500,
  propertyTaxesPaid: 15000,
  mortgageInterestPaid: 30000,
  mortgageBalance: 900000,
  charitableContributions: 20000,
  stateTaxWithheld: 28000,
  priorYearFederalTax: 90000,
  priorYearStateTax: 30000,
} as const;

const TOOL_NAMES = [
  "estimate_tax",
  "check_safe_harbor",
  "compare_charitable_giving",
  "compare_filing_status",
  "estimate_withholding",
  "list_jurisdictions",
];

describe("MCP route", () => {
  beforeEach(() => {
    clearRateLimits();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("OPTIONS", () => {
    it("returns 204 with CORS headers for a preflight", async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "POST",
      );
    });
  });

  describe("GET and DELETE (stateless)", () => {
    it("rejects a GET session stream with 405", async () => {
      const response = await GET(
        new Request("http://localhost/api/mcp", {
          method: "GET",
          headers: { Accept: "text/event-stream" },
        }),
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("rejects a DELETE session termination with 405", async () => {
      const response = await DELETE(
        new Request("http://localhost/api/mcp", { method: "DELETE" }),
      );

      expect(response.status).toBe(405);
    });
  });

  describe("lifecycle", () => {
    it("negotiates the protocol version and names the server on initialize", async () => {
      const response = await POST(
        createMcpRequest({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "test-client", version: "1.0.0" },
          },
        }),
      );
      const data = await readJsonRpc(response);

      expect(response.status).toBe(200);
      expect(data.id).toBe(1);
      expect(data.result.protocolVersion).toBe("2025-06-18");
      expect(data.result.serverInfo.name).toBe("estimate.tax");
      expect(data.result.capabilities.tools).toBeDefined();
    });

    it("accepts notifications/initialized with 202 and no body", async () => {
      const response = await POST(
        createMcpRequest({ jsonrpc: "2.0", method: "notifications/initialized" }),
      );

      expect(response.status).toBe(202);
      expect(await response.text()).toBe("");
    });

    it("responds to ping", async () => {
      const data = await readJsonRpc(
        await POST(createMcpRequest({ jsonrpc: "2.0", id: 7, method: "ping" })),
      );

      expect(data.id).toBe(7);
      expect(data.result).toEqual({});
    });
  });

  describe("tools/list", () => {
    it("lists the six tools, all read-only, with JSON Schema derived from Zod", async () => {
      const data = await readJsonRpc(
        await POST(
          createMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
        ),
      );

      const tools = data.result.tools;
      expect(tools.map((tool: { name: string }) => tool.name)).toEqual(
        TOOL_NAMES,
      );
      for (const tool of tools) {
        expect(tool.annotations.readOnlyHint).toBe(true);
        expect(tool.description.length).toBeGreaterThan(40);
      }

      const estimate = tools[0];
      expect(estimate.inputSchema.required).toEqual([
        "filingStatus",
        "selectedState",
      ]);
      expect(estimate.inputSchema.additionalProperties).toBe(false);
      expect(estimate.inputSchema.properties.taxYear.default).toBe(TAX_YEAR);
      expect(
        estimate.inputSchema.properties.federalTaxWithheld.description,
      ).toContain("estimated from wages");
    });
  });

  describe("estimate_tax", () => {
    it("returns the summary the calculators produce, rounded to cents", async () => {
      const data = await callTool("estimate_tax", EXAMPLE);

      expect(data.error).toBeUndefined();
      const result = data.result.structuredContent;
      expect(JSON.parse(data.result.content[0].text)).toEqual(result);

      const inputs = createDefaultInputs({ ...EXAMPLE, taxYear: TAX_YEAR });
      const expected = calculateEstimate(
        inputs,
        loadFederalData(TAX_YEAR),
        loadStateDataSync("california", TAX_YEAR),
      ).results;
      const cents = (n: number) => Math.round(n * 100) / 100;

      expect(result.taxYear).toBe(TAX_YEAR);
      expect(result.federal.totalTax).toBe(cents(expected.federal.totalTax));
      expect(result.federal.remainingOwed).toBe(
        cents(expected.federal.remainingOwed),
      );
      expect(result.state.totalTax).toBe(cents(expected.state.totalTax));
      expect(result.federal.withheldSource).toBe("estimate");
      expect(result.state.withheldSource).toBe("user_input");
      expect(result.state.withheld).toBe(28000);
      expect(result.federal.payrollTax.note).toContain("not part of the tax owed");
      expect(result.state.payrollTax).toBeUndefined();
      expect(result.federal.safeHarbor.priorYearShare.percent).toBe(1.1);
    });

    it("rounds every amount to cents and every rate to six places", async () => {
      const data = await callTool("estimate_tax", {
        ...EXAMPLE,
        detail: "full",
      });

      const seen: number[] = [];
      const walk = (value: unknown) => {
        if (typeof value === "number") seen.push(value);
        else if (value && typeof value === "object")
          Object.values(value).forEach(walk);
      };
      walk(data.result.structuredContent);

      expect(seen.length).toBeGreaterThan(50);
      for (const n of seen) {
        expect(Math.abs(n * 1e6 - Math.round(n * 1e6))).toBeLessThan(1e-6);
      }
    });

    it("says what it assumed for fields left out", async () => {
      const data = await callTool("estimate_tax", EXAMPLE);

      const fields = data.result.structuredContent.assumptions.map(
        (assumption: { field: string; source: string }) =>
          `${assumption.field}:${assumption.source}`,
      );
      expect(fields).toEqual([
        "federalTaxWithheld:estimate",
        "priorYearIncomeOverThreshold:default",
        "stateIncome:default",
      ]);
    });

    it("reports the data status for the year", async () => {
      const data = await callTool("estimate_tax", { ...EXAMPLE, taxYear: "2025" });

      expect(data.result.structuredContent.data).toEqual({
        year: "2025",
        verifiedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        waiting: [],
      });
    });

    it("returns both complete breakdowns when detail is full", async () => {
      const data = await callTool("estimate_tax", {
        ...EXAMPLE,
        detail: "full",
      });

      const result = data.result.structuredContent;
      expect(result.federal.ordinaryIncomeBracketBreakdown.length).toBeGreaterThan(
        3,
      );
      expect(result.state.deductionBreakdown.deductionUsed).toBe("itemized");
    });

    it("returns a tool error naming the field for an unknown or invalid field", async () => {
      const unknown = await callTool("estimate_tax", {
        ...EXAMPLE,
        ssn: "000-00-0000",
      });
      expect(unknown.result.isError).toBe(true);
      expect(unknown.result.content[0].text).toContain("ssn");
      expect(unknown.result.content[0].text).not.toContain("000-00-0000");

      const negative = await callTool("estimate_tax", {
        ...EXAMPLE,
        federalIncome: -1,
      });
      expect(negative.result.isError).toBe(true);
      expect(negative.result.content[0].text).toContain("federalIncome");
    });

    it("returns a tool error naming the missing required fields", async () => {
      const data = await callTool("estimate_tax", { federalIncome: 100000 });

      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("filingStatus");
      expect(data.result.content[0].text).toContain("selectedState");
    });
  });

  describe("check_safe_harbor", () => {
    it("reports each jurisdiction's required amount, payments and shortfall", async () => {
      const data = await callTool("check_safe_harbor", EXAMPLE);

      const result = data.result.structuredContent;
      expect(result.federal.required).toBeGreaterThan(0);
      expect(result.federal.method).toMatch(/^(currentYear|priorYear)$/);
      expect(result.federal.paid.withheld.source).toBe("estimate");
      expect(result.state.paid.withheld).toEqual({
        amount: 28000,
        source: "user_input",
      });
      expect(result.state.remaining).toBe(
        Math.round(Math.max(0, result.state.required - 28000) * 100) / 100,
      );
      expect(result.note).toContain("installments");
    });

    it("has no state side for a state without a safe harbor", async () => {
      const data = await callTool("check_safe_harbor", {
        filingStatus: "single",
        selectedState: "florida",
        federalIncome: 200000,
      });

      expect(data.result.structuredContent.state).toBeNull();
    });
  });

  describe("compare_charitable_giving", () => {
    it("compares each amount with giving nothing", async () => {
      const data = await callTool("compare_charitable_giving", {
        ...EXAMPLE,
        contributions: [10000, 20000, 40000],
      });

      const result = data.result.structuredContent;
      expect(result.scenarios).toHaveLength(3);
      expect(result.scenarios[1].contributions).toBe(20000);
      expect(result.scenarios[1].totalSaved).toBe(
        result.scenarios[1].federalSaved + result.scenarios[1].stateSaved,
      );
      expect(result.scenarios[2].totalSaved).toBeGreaterThan(
        result.scenarios[0].totalSaved,
      );
      expect(result.noGiving.federalTax).toBeGreaterThan(
        result.scenarios[2].federalTax,
      );
    });

    it("refuses more than twelve amounts", async () => {
      const data = await callTool("compare_charitable_giving", {
        ...EXAMPLE,
        contributions: Array.from({ length: 13 }, (_, i) => i * 1000),
      });

      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("contributions");
    });
  });

  describe("compare_filing_status", () => {
    const COUPLE = {
      filingStatus: "marriedFilingJointly",
      selectedState: "california",
      federalIncome: 500000,
      longTermCapitalGains: 100000,
      federalTaxWithheld: 100000,
      stateTaxWithheld: 40000,
    };

    it("compares the joint return with two separate returns", async () => {
      const data = await callTool("compare_filing_status", {
        ...COUPLE,
        split: { wages: 80 },
      });

      const result = data.result.structuredContent;
      expect(result.joint.totalTax).toBeGreaterThan(0);
      expect(result.separate.spouse1.federalTax).toBeGreaterThan(
        result.separate.spouse2.federalTax,
      );
      expect(result.separate.combined.totalTax).toBe(
        Math.round(
          (result.separate.spouse1.totalTax + result.separate.spouse2.totalTax) *
            100,
        ) / 100,
      );
      expect(result.difference.totalTax).toBe(
        Math.round(
          (result.separate.combined.totalTax - result.joint.totalTax) * 100,
        ) / 100,
      );
    });

    it("refuses a filing status other than married filing jointly", async () => {
      const data = await callTool("compare_filing_status", {
        ...COUPLE,
        filingStatus: "single",
      });

      expect(data.result.isError).toBe(true);
      expect(data.result.content[0].text).toContain("marriedFilingJointly");
    });
  });

  describe("estimate_withholding", () => {
    it("estimates federal and state withholding from the wage fields", async () => {
      const data = await callTool("estimate_withholding", {
        filingStatus: "single",
        selectedState: "california",
        federalIncome: 300000,
        supplementalWages: 50000,
      });

      const result = data.result.structuredContent;
      expect(result.federal).toBeGreaterThan(0);
      expect(result.federalSupplemental).toBe(11000); // 22% of $50,000
      expect(result.state).toBeGreaterThan(0);
      expect(result.method.state).toContain("Method B");
    });

    it("returns null for a state whose withholding is not modelled", async () => {
      const data = await callTool("estimate_withholding", {
        filingStatus: "single",
        selectedState: "dc",
        federalIncome: 300000,
      });

      expect(data.result.structuredContent.state).toBeNull();
      expect(data.result.structuredContent.method.state).toBeNull();
    });

    it("rejects fields outside the wage inputs", async () => {
      const data = await callTool("estimate_withholding", {
        filingStatus: "single",
        selectedState: "dc",
        federalIncome: 300000,
        charitableContributions: 1000,
      });

      expect(data.result.isError).toBe(true);
    });
  });

  describe("list_jurisdictions", () => {
    it("lists the years, the states and the data status", async () => {
      const data = await callTool("list_jurisdictions", {});

      const result = data.result.structuredContent;
      expect(result.years).toEqual(["2025", "2026"]);
      expect(result.defaultYear).toBe(TAX_YEAR);
      expect(result.states).toHaveLength(7);
      expect(
        result.states.find((state: { id: string }) => state.id === "washington"),
      ).toMatchObject({ incomeTax: "none", capitalGains: "ltcgOnly" });
      expect(result.data["2026"].verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("errors", () => {
    it("returns method not found for an unknown method", async () => {
      const data = await readJsonRpc(
        await POST(
          createMcpRequest({ jsonrpc: "2.0", id: 1, method: "unknown/method" }),
        ),
      );

      expect(data.error?.code).toBe(-32601);
    });

    it("names an unknown tool", async () => {
      const data = await callTool("unknown_tool", {});

      expect(data.error?.message).toContain("unknown_tool");
    });

    it("returns a parse error for invalid JSON", async () => {
      const response = await POST(createMcpRequest("{not json"));
      const data = await readJsonRpc(response);

      expect(response.status).toBe(400);
      expect(data.error?.code).toBe(-32700);
    });

    it("rejects an oversized body with 413", async () => {
      const response = await POST(
        createMcpRequest({
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
          params: { padding: "x".repeat(70 * 1024) },
        }),
      );

      expect(response.status).toBe(413);
    });
  });

  describe("rate limiting", () => {
    it(`returns 429 with Retry-After after ${RATE_LIMIT} requests from one IP`, async () => {
      const headers = { "x-forwarded-for": "203.0.113.7" };

      for (let i = 0; i < RATE_LIMIT; i++) {
        const response = await POST(
          createMcpRequest({ jsonrpc: "2.0", id: i, method: "ping" }, headers),
        );
        expect(response.status).toBe(200);
      }

      const limited = await POST(
        createMcpRequest(
          { jsonrpc: "2.0", id: RATE_LIMIT + 1, method: "ping" },
          headers,
        ),
      );
      const data = await limited.json();

      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(data.error?.code).toBe(-32001);
      expect(limited.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("does not count one IP's requests against another", async () => {
      for (let i = 0; i < RATE_LIMIT; i++) {
        await POST(
          createMcpRequest(
            { jsonrpc: "2.0", id: i, method: "ping" },
            { "x-forwarded-for": "203.0.113.8" },
          ),
        );
      }

      const other = await POST(
        createMcpRequest(
          { jsonrpc: "2.0", id: 1, method: "ping" },
          { "x-forwarded-for": "203.0.113.9" },
        ),
      );

      expect(other.status).toBe(200);
    });
  });

  describe("privacy", () => {
    it("logs only the method, status, tool name and duration", async () => {
      const log = vi.mocked(console.log);

      await callTool("estimate_tax", EXAMPLE);

      const lines = log.mock.calls.map((call) => call.join(" "));
      expect(lines.some((line) => line.includes("tools/call estimate_tax"))).toBe(
        true,
      );
      expect(lines.some((line) => line.includes("POST 200"))).toBe(true);
      for (const line of lines) {
        expect(line).not.toContain("400000");
        expect(line).not.toContain("federalIncome");
      }
    });
  });
});
