# Implementation status

Updated: 2026-08-25

## Completed

- MVP product, custody, protocol, fee, package, asset, retention, licensing, and automation
  defaults are resolved in the decision register and accepted ADRs.
- Official x402 v2 schema and HTTP transport assumptions are pinned for the initial kernel.
- Public/protocol packages are designated Apache-2.0; no repository-wide license is asserted.

## Current protocol assumptions

- Baseline packages: `@x402/core` 2.23.0 and `@x402/evm` 2.23.0 (npm registry,
  observed 2026-08-25).
- Baseline source: x402 `main` commit
  `dd927a26cfefc98c24b3ec38b3a8f204dad0c60d` (observed 2026-08-25).
- x402 version is numeric `2`. `PAYMENT-REQUIRED` is base64-encoded JSON containing
  `x402Version`, `resource`, `accepts`, and optional `error`, `extensions`.
- Each accepted requirement contains `scheme`, CAIP-2 `network`, atomic-unit decimal-string
  `amount`, asset, `payTo`, positive integer `maxTimeoutSeconds`, and optional `extra`.
- This milestone supports only EVM `exact`, Base (`eip155:8453`), and canonical Base USDC.
  The x402 wire schema expresses an EVM asset as a contract address; AnyX normalizes it to CAIP-19
  internally and selects only an exact address allowlist match.
- The resource server sends the challenge, receives `PAYMENT-SIGNATURE`, and owns facilitator
  verify/settle. The successful response carries `PAYMENT-RESPONSE`. The client never pre-settles.
- Unknown extensions/fields are preserved in the parsed challenge and deterministic fingerprint,
  but unsupported protocol versions, schemes, networks, and assets fail selection closed.

Primary sources:

- [x402 v2 specification](https://github.com/coinbase/x402/blob/dd927a26cfefc98c24b3ec38b3a8f204dad0c60d/specs/x402-specification-v2.md)
- [x402 v2 HTTP transport](https://github.com/coinbase/x402/blob/dd927a26cfefc98c24b3ec38b3a8f204dad0c60d/specs/transports-v2/http.md)
- [x402 HTTP 402 documentation](https://docs.x402.org/core-concepts/http-402)
- [Circle USDC addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Base contract addresses](https://docs.base.org/base-chain/network-information/base-contracts)

## Next

- Deterministic protocol/config workspace, tests, and package usage documentation.
- Reference merchant/facilitator conformance fixture and Base Sepolia vertical flow.
- DEX route qualification and wallet adapter selection after the kernel boundary is stable.

## Externally blocked

- DEX provider/commercial terms and verified USDT route/address qualification.
- Facilitator selection, authentication/terms, and live conformance.
- Wallet compatibility and funded testnet setup.
- Trademark/npm namespace approval before publishing `@anyx/sdk`.
- Legal approval for fee disclosures, custody claims, sanctions/privacy/retention, and mainnet.
- Hosted control-plane/repository-wide licensing and contribution policy.
- Production cloud, RPC, release identities, security review, and human release approvals.
