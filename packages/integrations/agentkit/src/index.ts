/** Coinbase AgentKit action descriptor (runtime AgentKit dep is Phase 7). */
export const ANYX_PAY_ACTION = {
  name: "anyx_pay_x402_api",
  description:
    "Pay for access to any x402-gated API using ETH, USDT, or other tokens via AnyX universal adapter",
  schema: {
    endpointUrl: "string",
    inputToken: "string",
  },
};
