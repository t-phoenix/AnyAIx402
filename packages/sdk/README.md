# @anyx/sdk

Drop-in `fetch()` that pays x402 APIs with ETH, USDT, or any registered token.

```bash
npm install @anyx/sdk
```

```ts
import { UPA } from "@anyx/sdk";

const upa = new UPA({
  preferredToken: "ETH",
  preferredChainId: 8453,
  apiBaseUrl: "http://localhost:3000",
});

const res = await upa.fetch("https://api.example.com/data");
const data = await res.json();
```

`upa.quote(url)` returns the token cost (30s TTL) before you pay.
