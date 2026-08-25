import type { UPA } from "@anyx/sdk";

/** MCP tool list for Claude Code / Cursor. Runtime MCP SDK wiring is Phase 7. */
export const MCP_TOOLS = [
  {
    name: "anyx_quote",
    description: "Get a price quote to pay for an x402-gated API with ETH, USDT, or WBTC",
    inputSchema: {
      type: "object",
      properties: {
        endpointUrl: { type: "string" },
        inputToken: { type: "string" },
      },
      required: ["endpointUrl"],
    },
  },
  {
    name: "anyx_pay",
    description: "Pay for an x402-gated API and return the response",
    inputSchema: {
      type: "object",
      properties: {
        endpointUrl: { type: "string" },
        quoteId: { type: "string" },
      },
      required: ["endpointUrl"],
    },
  },
  {
    name: "anyx_supported_tokens",
    description: "List tokens AnyX accepts as payment input",
    inputSchema: { type: "object", properties: {} },
  },
];

export function createMcpHandlers(upa: UPA) {
  return {
    async anyx_quote(endpointUrl: string) {
      return upa.quote(endpointUrl);
    },
    async anyx_pay(endpointUrl: string, quoteId?: string) {
      return upa.pay(endpointUrl, quoteId);
    },
  };
}
