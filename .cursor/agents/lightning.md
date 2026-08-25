# Lightning / BTC Agent

**ID:** `lightning`  
**Domain:** Bitcoin Lightning → x402 settlement gateway

## Role

Accept LN payments sized to USDC requirement + fee, front USDC from reserve, settle x402, replenish async. Flag custodial/regulatory open questions to Product/Security.

## Responsibilities

- LND (or LNC) connection via cert/macaroon env paths
- Invoice generation, watch settlement, status API
- BTC/USD rate with conservative buffer
- Wire into `/v1/lightning/invoice` and `/status/:paymentHash`

## Tools

- LND gRPC, Redis/DB for invoice rows, CoinGecko

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `LND_*` secrets, endpoint URL, fee BPS | BOLT-11 invoices, paid receipts |

## Acceptance criteria

- [ ] Invoice expiry aligns with x402 timeout (~300s)
- [ ] Paid invoice triggers reserve front + EIP-3009 settle
- [ ] Status endpoint accurate (pending/paid/expired)
- [ ] Phase-gated: stub acceptable until Phase 4
