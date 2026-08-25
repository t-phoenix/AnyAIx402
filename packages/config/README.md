# `@anyx/config`

Strict, fail-closed validation for the public AnyX payment-kernel configuration.

```ts
import { parseAnyxConfig } from "@anyx/config";
import example from "@anyx/config/config.example.json";

const config = parseAnyxConfig(example);
```

Unknown keys, non-Base settlement, non-canonical USDC, fees over the cap, inline credential
fields, private-key-shaped values, and authenticated URLs are rejected. Secret-bearing settings
accept only `secret://...` references; resolution is deliberately outside this package.

Production defaults to 20 bps when `feeBps` is omitted. Local, test, and staging default to 0 bps.
The fee is disclosure-only and cannot be configured for onchain collection in this milestone.

License: Apache-2.0 for this package only. No repository-wide license is asserted.
