# x402 Protocol Agent

**ID:** `x402-protocol`  
**Domain:** x402 v2 protocol client, challenge parsing, facilitator interaction

## Role

Implement and maintain x402-compatible challenge parsing, payment header encoding, and facilitator verify/settle with failover — without changing the x402 server protocol.

## Responsibilities

- `fetch402Challenge`, `parsePaymentRequired` (zod schema, x402 v2)
- Prefer Base USDC option (`eip155:8453`, USDC address)
- `buildPaymentHeader` / `submitPayment` (X-PAYMENT)
- Facilitator client: verify, settle, health check, failover (Coinbase CDP → self-hosted)
- Align with whitepaper §3 and PRD FR-3

## Tools

- HTTP fetch, zod, viem, Vitest mocks

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| 402 responses, facilitator URLs from env | `@anyx/core` x402 + facilitator modules + tests |

## Acceptance criteria

- [ ] Parses JSON body and base64 PAYMENT-REQUIRED header
- [ ] Errors clearly when no Base USDC option
- [ ] Failover within ~2s on primary 5xx
- [ ] Unit tests for parse + failover
