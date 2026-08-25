# @anyx/sdk

Pay any x402-gated API with any token.

x402 settles exclusively in USDC on Base. If your agent holds ETH, USDT or SOL,
it cannot pay without acquiring USDC first. This SDK removes that step: it
intercepts the `402`, routes your token through a DEX aggregator, signs the
EIP-3009 authorization, and returns the resource.

```bash
npm install @anyx/sdk
```

## Ten lines

```ts
import { UPA } from '@anyx/sdk';

const upa = new UPA({
  preferredToken: 'ETH',
  preferredChainId: 8453,
  wallet,
});

const res = await upa.fetch('https://api.example.com/data');
const data = await res.json();
```

`upa.fetch` is a drop-in for `fetch`. Anything other than a 402 passes straight
through, so it is safe to substitute globally. On a 402 the challenge, the
quote, the swap, the authorization and the retry all happen inside the call.

## Configuration

```ts
const upa = new UPA({
  preferredToken: 'ETH',        // required — the token you want to pay with
  preferredChainId: 8453,       // required — the chain you hold it on

  wallet,                       // viem WalletClient, for on-chain flows
  walletAddress: '0x…',         // or just the address
  apiKey: 'anyx_…',             // optional on the free tier
  apiBaseUrl: 'https://api.anyx.xyz',

  maxSlippage: 0.005,           // 0.5%; reject a quote above this
  maxFeePercent: 0.01,          // 1%; reject a quote whose fee exceeds this
  timeoutMs: 30_000,

  onPayment: (receipt) => log(receipt),
  onSwap: (event) => log(event),
  onError: (error) => log(error),
});
```

`maxFeePercent` and `maxSlippage` are enforced before anything is paid. A quote
that breaches either throws and `/v1/pay` is never called, so no money moves.

## Seeing the cost first

```ts
const quote = await upa.quote('https://api.example.com/data');

console.log(quote.inputAmount);   // atomic units of your token
console.log(quote.usdcRequired);  // what the API charges
console.log(quote.fee.usdc);      // the AnyX spread
console.log(quote.expiresAt);     // valid for 30 seconds

const res = await upa.fetch('https://api.example.com/data', { useQuote: quote });
```

Quotes expire in 30 seconds because DEX prices do. Do not cache one across
turns of an agent loop.

## Methods

| Method | Purpose |
| --- | --- |
| `fetch(url, init?)` | Drop-in `fetch` that settles a 402 transparently |
| `quote(url)` | Price a payment without committing to it |
| `pay(url, quoteId?)` | Settle and return the receipt |
| `getReceipt(id)` | Retrieve a past receipt |
| `getSupportedTokens()` | Every supported input token with its current price |

`fetch` accepts two extra options beyond the standard `RequestInit`:
`useQuote` to settle against a quote you already hold, and `skipPayment` to
return the raw 402 untouched.

## Events

```ts
const off = upa.on('payment', (receipt) => {
  console.log(`${receipt.inputAmount} ${receipt.inputToken} → ${receipt.apiCostUSDC} USDC`);
  console.log(receipt.txHash);
});

upa.on('swap', (event) => console.log(event.source, event.usdcReceived));
upa.on('error', (error) => console.error(error.code, error.message));

off(); // unsubscribe
```

`on` returns its own unsubscribe function. A listener that throws is contained —
it will never fail the payment that triggered it.

## Receipts

Every settled payment produces an itemized receipt:

```ts
{
  receiptId: 'uuid',
  timestamp: '2026-01-01T00:00:00.000Z',
  endpoint: 'https://api.example.com/data',
  inputToken: 'ETH',
  inputAmount: '0.0004214',
  inputAmountUSD: '1.0023',
  apiCostUSDC: '1.000',      // what the provider received
  adapterFeeUSDC: '0.002',   // what AnyX kept
  swapSlippage: '0.0012',    // what actually happened, not the estimate
  txHash: '0x…',
  blockNumber: 22891234,
  facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
  status: 'settled',
}
```

The response from `upa.fetch` also carries `x-anyx-receipt-id` and
`x-anyx-tx-hash` headers, so you can reconcile without holding the receipt.

## Errors

Every failure is a `UPAError` with a `code`:

```ts
import { UPAError } from '@anyx/sdk';

try {
  await upa.fetch(url);
} catch (error) {
  if (error instanceof UPAError && error.code === 'FEE_TOO_HIGH') {
    // the quote breached your maxFeePercent; nothing was paid
  }
}
```

| Code | Meaning |
| --- | --- |
| `QUOTE_NOT_FOUND` / `QUOTE_EXPIRED` | Re-quote |
| `SWAP_FAILED` | Slippage moved past tolerance; re-quote rather than retry |
| `SETTLEMENT_FAILED` | The facilitator could not settle |
| `INSUFFICIENT_BALANCE` | The wallet cannot cover the input amount |
| `FEE_TOO_HIGH` / `SLIPPAGE_TOO_HIGH` | Your own guardrail rejected the quote; nothing was paid |
| `RATE_LIMITED` | Back off; upgrade for a higher limit |
| `INVALID_INPUT` | Bad request |
| `NETWORK_ERROR` | The AnyX API was unreachable |

## Fees

The spread is applied on top of the required amount, never taken out of it:

```
inputAmount = requiredUSDC / (1 - feeBps / 10000)
```

A $1.00 API call at 20 bps means you swap $1.002 worth of your token. The
provider receives exactly $1.00.

| Pair | Spread |
| --- | --- |
| USDT → USDC | 0.05% |
| ETH → USDC | 0.20% |
| BTC → USDC | 0.50% |
| Cross-chain | 0.30% |

## Notes

**No runtime dependencies.** Installing this does not pull a wallet library into
your project. The wallet is typed structurally, so a viem `WalletClient` fits
without viem being a dependency.

**Partial payments are impossible.** `minAmountOut` always equals the required
USDC. A swap that would come up short reverts rather than underpaying.

**Self-hosting.** Point `apiBaseUrl` at your own deployment:

```ts
const upa = new UPA({ apiBaseUrl: 'http://localhost:3000', /* … */ });
```

## Links

- [Repository](https://github.com/t-phoenix/AnyAIx402)
- [Architecture](https://github.com/t-phoenix/AnyAIx402/blob/main/docs/architecture.md)
- [Getting started](https://github.com/t-phoenix/AnyAIx402/blob/main/docs/getting-started.md)

Apache-2.0
