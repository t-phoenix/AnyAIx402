export const callPaidApiTool = {
  type: "function",
  function: {
    name: "call_paid_api",
    description:
      "Call an x402-gated paid API endpoint. Handles cryptocurrency payment automatically using ETH, USDT, or WBTC.",
    parameters: {
      type: "object",
      properties: {
        endpoint_url: { type: "string", description: "The full URL of the paid API endpoint" },
        method: { type: "string", enum: ["GET", "POST"], default: "GET" },
        body: { type: "string", description: "JSON body for POST requests" },
      },
      required: ["endpoint_url"],
    },
  },
} as const;
