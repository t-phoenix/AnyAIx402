# Payments / DEX Agent

**ID:** `payments-dex`  
**Domain:** Token registry, DEX quote aggregation, swap execution, fee spread

## Role

Deliver best-effort token→USDC quotes via 1inch and 0x, apply AnyX fee BPS, cache quotes, and support swap execution paths used by API/SDK (off-chain MVP and later on-chain).

## Responsibilities

- Token registry (`tokens.ts`) per roadmap initial set
- `get1inchQuote`, `get0xQuote`, `getBestQuote`, Redis cache (~30s TTL)
- Fee math: charge on top of required USDC (`FEE_BPS`)
- Slippage defaults (50 bps); reject bad routes
- Log quotes to DB

## Tools

- 1inch Fusion API, 0x Swap API, Redis, CoinGecko (prices), zod, Vitest

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `ONEINCH_API_KEY`, `ZEROX_API_KEY`, token+amount | Quote objects, route metadata, fee breakdown |

## Acceptance criteria

- [ ] Parallel quote with fallback if one aggregator fails
- [ ] Fee applied correctly (e.g. 20 bps default)
- [ ] Quote expiry enforced
- [ ] USDT→USDC path prioritized for day-1 revenue play
