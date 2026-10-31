/**
 * MCP (Model Context Protocol) endpoint: estimate.tax's calculations as
 * tools for AI assistants and other programs.
 *
 * Streamable HTTP. Protocol handling (JSON-RPC framing, version negotiation,
 * tools/list, tools/call, ping) is the MCP SDK's; this route adds rate
 * limiting and CORS, the same shape as dawnward's route.
 *
 * Served statelessly: a fresh server is built per request, so GET/DELETE
 * session operations from older clients return 405.
 *
 * Public and unauthenticated: the tools are pure calculations over the
 * inputs in each call, there is no account and nothing is stored. The server
 * does not log request bodies, tool arguments or results; see the privacy
 * section of README.md.
 */

import { createMcpHandler } from "@modelcontextprotocol/server";

import { getClientIP } from "@/lib/clientIp";
import { createTaxServer } from "@/lib/mcp/server";
import { checkRateLimit, getRateLimitStatus } from "@/lib/rateLimiter";

// Requests per hour per IP. Higher than dawnward's 100 because connector
// traffic from claude.ai shares a few egress addresses.
export const RATE_LIMIT = 600;
const MAX_BODY_SIZE = 64 * 1024; // 64KB max request body
const RATE_LIMIT_ERROR_CODE = -32001; // Custom JSON-RPC server error
const MS_PER_SECOND = 1000;

// MCP clients are AI assistants on other origins, so CORS is open
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, MCP-Protocol-Version",
};

const mcpHandler = createMcpHandler(createTaxServer, {
  legacy: "stateless",
  maxRequestBodySize: MAX_BODY_SIZE,
  // This server never publishes change events, so refuse long-lived
  // subscriptions that would otherwise pin a function open
  maxSubscriptions: 0,
  onerror: (error) => console.error("[MCP] Handler error:", error),
});

// A copy of the response with CORS headers, passing a streaming body through
function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// HTTP 429 with a JSON-RPC error body and a Retry-After header
function rateLimitResponse(ip: string): Response {
  const { resetAt } = getRateLimitStatus(ip, RATE_LIMIT);
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt.getTime() - Date.now()) / MS_PER_SECOND),
  );

  return withCors(
    Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: RATE_LIMIT_ERROR_CODE,
          message: `Rate limit exceeded (${RATE_LIMIT} requests per hour). Resets at ${resetAt.toISOString()}`,
        },
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) },
      },
    ),
  );
}

async function handleMcpRequest(request: Request): Promise<Response> {
  const ip = getClientIP(request);
  if (!checkRateLimit(ip, RATE_LIMIT)) {
    return rateLimitResponse(ip);
  }

  // Tool timing is logged in lib/mcp/server.ts; only the method and status
  // are logged here, never the body
  const response = await mcpHandler.fetch(request);
  console.log(`[MCP] ${request.method} ${response.status}`);

  return withCors(response);
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export {
  handleMcpRequest as GET,
  handleMcpRequest as POST,
  handleMcpRequest as DELETE,
};
