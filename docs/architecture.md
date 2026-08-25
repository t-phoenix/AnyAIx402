# Architecture

AnyX is payer-side middleware. It changes nothing about the x402 protocol and
nothing about the servers that use it. All of the complexity lives between the
payer's wallet and the x402 endpoint.

## Component layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ PAYER — AI agent, wallet, CI pipeline, or application               │
│ holds: ETH · WBTC · cbBTC · USDT · SOL · BTC · any ERC-20           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP request to an x402-gated API
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ANYX                                                                │
│                                                                     │
│   ┌───────────────┐    ┌──────────────────┐    ┌────────────────┐   │
│   │ 402 intercept │───►│  Quote engine    │───►│ EIP-3009       │   │
│   │ and parser    │    │  1inch ∥ 0x      │    │ signer         │   │
│   │ (x402.ts)     │    │  (quote.ts)      │    │ (eip3009.ts)   │   │
│   └───────────────┘    └──────────────────┘    └────────────────┘   │
│           │                     │                       │           │
│           ▼                     ▼                       ▼           │
│   ┌───────────────┐    ┌──────────────────┐    ┌────────────────┐   │
│   │ Token registry│    │  Bridge layer    │    │ Facilitator    │   │
│   │ and valuation │    │  CCTP / Stargate │    │ client with    │   │
│   │ (tokens.ts)   │    │  (bridge/)       │    │ failover       │   │
│   └───────────────┘    └──────────────────┘    └────────────────┘   │
│                                 │                                   │
│                        ┌────────▼─────────┐                         │
│                        │  Reserve pool    │                         │
│                        │  USDC float      │                         │
│                        └──────────────────┘                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  a valid EIP-3009 authorization
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ x402 FACILITATOR — Coinbase CDP, with a mandatory fallback          │
│ verifies the signature, submits transferWithAuthorization on Base   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  USDC transfer + tx hash
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ API SERVER — x402-gated, entirely unmodified                        │
│ receives 200 OK + X-PAYMENT-RESPONSE                                │
└─────────────────────────────────────────────────────────────────────┘
```

The API server is the important part of that diagram: it is unchanged. From its
perspective it advertised a price in USDC on Base and received USDC on Base.
Whether the payer held ETH, satoshis or SPL tokens is invisible to it, which is
why AnyX needs no adoption from the supply side to be useful.

## A single payment, in sequence

```
payer          AnyX           1inch/0x        facilitator      x402 API
  │              │                │                │               │
  │─ fetch ──────┼────────────────┼────────────────┼──────────────►│
  │              │                │                │               │
  │◄─────────────┼────────────────┼────────────────┼── 402 ────────│
  │              │                │                │  PaymentRequired
  │              │                │                │               │
  │              │─ parse challenge               │               │
  │              │  amount, asset, payTo, network │               │
  │              │                │                │               │
  │              │─ quote ───────►│                │               │
  │              │◄── routes ─────│  both queried in parallel,     │
  │              │                │  best amountOut wins           │
  │              │                │                │               │
  │◄─ quote ─────│  itemized: input amount, fee, slippage, expiry  │
  │── approve ──►│                │                │               │
  │              │                │                │               │
  │              │─ swap ────────►│  reverts if output < required  │
  │              │◄── USDC ───────│                │               │
  │              │                │                │               │
  │              │─ sign EIP-712 TransferWithAuthorization         │
  │              │  validAfter 0, validBefore now+300s, random nonce
  │              │                │                │               │
  │              │─ verify ───────┼───────────────►│               │
  │              │─ settle ───────┼───────────────►│               │
  │              │                │                │─ on-chain ──► Base
  │              │◄── txHash ─────┼────────────────│               │
  │              │                │                │               │
  │              │─ retry with X-PAYMENT ──────────┼──────────────►│
  │              │◄────────────────────────────────┼── 200 OK ─────│
  │◄─ response ──│                │                │               │
  │   + receipt  │                │                │               │
```

The whole cycle is one interaction from the payer's point of view. The PRD
targets under 6 seconds at p95 for EVM tokens already on Base.

## Payment flows by asset

### EVM tokens on Base — ETH, WETH, USDT, cbBTC

The simple case, and the one that ships first. Everything happens on one chain.
The token is swapped to USDC via whichever aggregator quotes better, and the
authorization is signed and submitted. No bridge, no float, no waiting.

Slippage protection is absolute: `minAmountOut` equals the required USDC, so a
swap that would come up short reverts instead of partially paying. There is no
code path that sends less than the API asked for.

### EVM tokens on Ethereum — USDT, WBTC, WETH

Two options, chosen by urgency. Swap to USDC on Ethereum and bridge via CCTP
(2–10 minutes, no wrapped-token risk), or bridge via Stargate (under 2 minutes,
via a liquidity pool). Either way the x402 challenge's `maxTimeoutSeconds` is
typically 300, so the float pool usually fronts the payment on Base while the
bridge settles behind it.

### Solana — SOL and SPL tokens

Jupiter swaps to USDC on Solana, then Circle CCTP burns it there and mints
native USDC on Base. No wrapped tokens and no custodial bridge, but 2–10 minutes
of latency, so this path depends on the float pool for anything time-sensitive.

### Bitcoin — Lightning

The only path for the largest excluded market. AnyX issues a BOLT-11 invoice
sized at the required USDC plus fee, converted at the live BTC/USD rate with a
conservative buffer. On settlement the payment is fronted from the USDC reserve
pool and the pool is replenished asynchronously via cbBTC.

This is custodial for the seconds between Lightning settlement and USDC
authorization. That window is a deliberate design decision with regulatory
implications, and it is called out as an open question in the PRD.

## The float pool

Cross-chain bridging takes minutes. The x402 timeout is 300 seconds. Those two
facts do not reconcile, so AnyX keeps a USDC float on Base and fronts the
payment immediately, replenishing behind the scenes once the bridge clears.

This is the one component that requires real working capital rather than an API
key, and running it dry means cross-chain payments start missing their window.

## Settlement

Every payment settles as an EIP-3009 `transferWithAuthorization` — an EIP-712
typed signature over `(from, to, value, validAfter, validBefore, nonce)`. The
payer signs off-chain; the facilitator submits on-chain and pays the gas.

The facilitator is a trusted relay but not a custodian: `from`, `to` and `value`
are locked by the signature, so it can submit the authorization or refuse, and
nothing else. Refusal is the real risk, which is why a fallback facilitator is
mandatory rather than optional.

Authorizations are valid for 5 minutes and carry a random 32-byte nonce, which
bounds the damage from a compromised signer and makes replay a non-issue.

## Fees

The spread is applied on top of the required amount, never taken out of it:

```
inputAmount = requiredUSDC / (1 - feeBps / 10_000)
```

A $1.00 API call at 20 bps means the payer swaps $1.002 worth of their token.
The provider receives exactly $1.00 and AnyX keeps $0.002. Per-token rates live
in `packages/core/src/fees.ts` — tighter for stablecoin pairs where slippage is
near zero, wider for BTC.

## Degraded operation

Every external dependency has a defined failure mode, because a payment system
that only works when everything is up is not a payment system.

| Missing | Behaviour |
| --- | --- |
| Postgres | In-memory receipts; reported at `/health` |
| Redis | Quote cache and rate limiting fall back to memory |
| One DEX aggregator | The other serves quotes alone |
| Both aggregators | Typed `QuoteError`; no payment is attempted |
| Primary facilitator | Failover to the fallback after a 2-second health check |
| CoinGecko | Prices reported as null rather than guessed |
| Float pool empty | Cross-chain payers wait for the bridge, with the estimate shown |

## Further reading

- [`docs/reference/whitepaper.md`](reference/whitepaper.md) — protocol analysis, threat model, fee model
- [`docs/reference/prd.md`](reference/prd.md) — requirements, personas, acceptance criteria
- [`docs/security.md`](security.md) — threat model and key management
