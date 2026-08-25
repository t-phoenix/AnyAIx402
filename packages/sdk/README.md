# @anyx/sdk

Drop-in `fetch()` replacement that automatically pays x402-gated APIs using any token you hold —
ETH, USDT, WBTC, and more — by routing through the [AnyX](../../README.md) API.

## Install

```bash
npm install @anyx/sdk
# or
bun add @anyx/sdk
```

## Basic usage

```typescript
import { UPA } from '@anyx/sdk';

const upa = new UPA({
  preferredToken: 'ETH',
  preferredChainId: 8453, // Base mainnet
  wallet: walletClient,   // viem WalletClient
});

// Drop-in for fetch() — auto-handles 402
const res = await upa.fetch('https://api.example.com/data');
const data = await res.json();
```

## Advanced usage

```typescript
// Get a quote first, then pay explicitly
const quote = await upa.quote('https://api.example.com/data');
console.log(`Will cost ${quote.inputAmount} ETH (${quote.usdcRequired} USDC)`);

const receipt = await upa.pay('https://api.example.com/data', { quoteId: quote.quoteId });
console.log(`Settled. TxHash: ${receipt.txHash}`);

// Event hooks
upa.on('payment', (receipt) => {
  console.log(`Paid ${receipt.inputAmount} ${receipt.inputToken}`);
});
upa.on('error', (err) => {
  console.error(`AnyX error [${err.code}]: ${err.message}`);
});
```

## Configuration

| Option | Default | Description |
|---|---|---|
| `preferredToken` | *(required)* | Token symbol to pay with: `'ETH'`, `'USDT'`, `'WBTC'`, etc. |
| `preferredChainId` | *(required)* | Chain where you hold `preferredToken`. |
| `wallet` | — | A viem `WalletClient`; required for `pay()`/`fetch()` (not for `quote()`). |
| `apiKey` | — | AnyX API key. Optional for the free tier. |
| `apiBaseUrl` | `https://api.anyx.xyz` | Point at a self-hosted AnyX API (e.g. `http://localhost:3000` for local dev). |
| `maxSlippage` | `0.005` (0.5%) | Slippage tolerance passed to `/v1/quote`. |
| `maxFeePercent` | `0.01` (1%) | `quote()`/`pay()` throw `FEE_TOO_HIGH` if AnyX's fee exceeds this. |
| `onPayment` | — | Called with the `PaymentReceipt` after every successful payment. |
| `onError` | — | Called with `{ code, message, details? }` whenever a method throws. |

## Error handling

Every method throws a `UPAError` with a `code` matching the API's documented error codes
(`docs/anyx-llms.txt` → "Error Reference"), plus SDK-only codes `NETWORK_ERROR`, `FEE_TOO_HIGH`,
and `WALLET_REQUIRED`:

```typescript
try {
  const res = await upa.fetch(endpoint);
  return await res.json();
} catch (err) {
  if (err instanceof UPAError && err.code === 'INSUFFICIENT_BALANCE') {
    return 'Cannot access this paid API — insufficient token balance.';
  }
  throw err;
}
```

## Local development against a self-hosted API

```typescript
const upa = new UPA({
  preferredToken: 'ETH',
  preferredChainId: 8453,
  apiBaseUrl: 'http://localhost:3000',
  wallet: walletClient,
});
```
