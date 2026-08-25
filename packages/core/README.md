# @anyx/core

The AnyX payment engine: everything needed to turn "the payer holds ETH" into a
settled USDC-on-Base x402 payment. No database, no Redis and no HTTP server
required — those are injected by `apps/api`.

## Modules

| Module           | Responsibility                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `tokens.ts`      | Typed token registry (`TOKEN_REGISTRY`, `getToken`, `getSupportedTokens`, `isSupported`) |
| `fees.ts`        | Spread maths, per-token fee table (whitepaper §7), `MIN_FEE_USDC` floor                |
| `quote.ts`       | 1inch + 0x aggregation, best-rate selection, quote caching, slippage guards            |
| `x402.ts`        | x402 v2 challenge fetching/parsing, `X-PAYMENT` header construction, payment replay    |
| `eip3009.ts`     | `TransferWithAuthorization` payload building, EIP-712 signing, signature recovery      |
| `facilitator.ts` | `/verify` and `/settle`, health-checked failover, settlement receipt polling           |
| `swap.ts`        | Swap-execution seam: pre-funded USDC float today, `AnyXRouter` later                   |
| `cache.ts`       | `CacheStore` interface with an in-memory implementation                                |
| `errors.ts`      | Typed errors and the API error-code contract                                           |

## Fee model

The spread is applied on top of the amount the x402 server requires:

```
grossUsdc = usdcRequired / (1 - feeBps / 10_000)
feeUsdc   = grossUsdc - usdcRequired      (floored at MIN_FEE_USDC)
```

Per-token defaults: USDT→USDC 5 bps, ETH/WETH→USDC 20 bps, BTC/WBTC/cbBTC→USDC
50 bps, SOL→USDC 30 bps, everything else `FEE_BPS` (20 bps).

## Safety rules enforced in code

- `minAmountOut` on every quote equals `usdcRequired` exactly
  (`assertNoPartialPayment`). A quote that would allow a shortfall is rejected
  before it can be used.
- After a swap, `assertSwapOutputSufficient` throws `SwapError` if the output is
  below `usdcRequired`. Partial x402 payments are not representable.
- Authorizations are valid for 300 seconds (`validAfter: 0`), matching the
  typical x402 `maxTimeoutSeconds`.

## Caching without Redis

`CacheStore` is a four-method interface. `InMemoryCacheStore` is the default, so
quote caching and rate limiting work with nothing running:

```ts
import { setDefaultCacheStore } from '@anyx/core'

setDefaultCacheStore(myRedisBackedStore) // apps/api does this when REDIS_URL is set
```

## Configuration

Read from the process environment via `src/env.ts`: `ONEINCH_API_KEY`,
`ZEROX_API_KEY`, `FACILITATOR_URL`, `FACILITATOR_FALLBACK_URL`, `PRIVATE_KEY`,
`FEE_BPS`, `MIN_FEE_USDC`, `RPC_URL_BASE`, `RPC_URL_ETHEREUM`, `RPC_URL_SOLANA`,
`CCTP_ATTESTER_URL`.

`@anyx/config` is the eventual single source of truth for typed configuration
across the monorepo. `src/env.ts` uses the same variable names, so adopting it is
a swap of the accessor, not a rename.

## Tests

```bash
bun test              # from packages/core
bun test --coverage
```

Every test mocks the network; no test makes a real HTTP request.
