# `@anyx/sdk`

Deterministic x402 v2 kernel for the AnyX self-custodial Base payment adapter.

```ts
import {
  BASE_ASSETS,
  BASE_MAINNET,
  decodePaymentRequiredHeader,
  selectPayment,
} from "@anyx/sdk";

const challenge = decodePaymentRequiredHeader(response.headers.get("PAYMENT-REQUIRED")!);
const selected = selectPayment(challenge, {
  schemes: ["exact"],
  networks: [BASE_MAINNET],
  settlementAssets: [BASE_ASSETS.usdc],
  maxAmountAtomic: 1_000_000n,
});
```

The package parses and validates challenges, applies an explicit selection policy, calculates
integer fees, derives fingerprints/idempotency keys, and guards payment-attempt transitions. It
does not sign, swap, settle, or replay HTTP requests. Unknown v2 fields are retained for
forward-compatible fingerprinting, while unsupported versions, schemes, networks, assets, and
recipients fail closed.

The current compatibility baseline and primary sources are recorded in
[`docs/IMPLEMENTATION_STATUS.md`](../../docs/IMPLEMENTATION_STATUS.md).

License: Apache-2.0 for this package only. No repository-wide license is asserted.
