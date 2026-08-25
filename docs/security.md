# Security

AnyX moves other people's money. This page is the threat model from the
whitepaper, the controls that address each threat, and the rules that are not
negotiable.

## Trust assumptions

Being explicit about what is trusted is more useful than claiming nothing is.

| Component | Trust level | Controlled by |
| --- | --- | --- |
| DEX aggregator routers | Trustless | Immutable on-chain contracts |
| USDC on Base | Trusted | Circle, audited |
| Circle CCTP | Semi-trusted | Circle — centralized burn and mint |
| x402 facilitator | Trusted relay | Coinbase or self-hosted |
| AnyX router contract | Auditable | AnyX, upgradeable proxy |
| Hot signer key | Trusted | AnyX, MPC-protected in production |

The facilitator is a relay, not a custodian: `from`, `to` and `value` are locked
by the signature, so it can submit an authorization or refuse it, and nothing
else. Refusal is the actual risk, which is why a fallback is mandatory.

## Threats

### Slippage manipulation — HIGH

An attacker front-runs the swap so it returns less USDC than the payment
requires, and the payer overspends.

**Control.** `minAmountOut` is set to the exact required USDC and enforced
on-chain. A swap that would come up short reverts. There is deliberately no code
path that settles a partial payment, and the client also aborts before signing
if the quoted slippage exceeds the configured tolerance.

Owner: `swap-routing`, `contracts`.

### Hot signer key compromise — HIGH

The signer can authorize USDC transfers on behalf of payers. Compromise exposes
every in-flight payment.

**Controls.**

- MPC in production. Turnkey or Lit Protocol, never a raw key.
  `bun run config:check --env production` rejects `signer.mode: "local"`.
- A per-session spend cap (`SIGNER_MAX_USDC_PER_SESSION`) bounds the loss.
- Authorizations expire after 5 minutes, so a stolen signature has a short life.
- Development keys are throwaway, funded with a few dollars, and never a
  personal wallet.

Owner: `security`, `protocol`.

### Bridge latency race — MEDIUM

CCTP takes 2–10 minutes. The x402 challenge typically expires in 300 seconds. A
cross-chain payment can miss its own window.

**Control.** The USDC float pool on Base fronts the payment immediately and the
bridge replenishes asynchronously. When the float is exhausted the payer is told
the estimated wait rather than being left with a silently failing payment.

Owner: `crosschain`.

### Oracle price manipulation — MEDIUM

Token valuation depends on price feeds. A stale or manipulated price causes an
under- or over-swap.

**Control.** Dual-source pricing with a deviation ceiling; reject rather than
guess when the sources disagree.

Owner: `swap-routing`.

### Facilitator censorship — LOW

The facilitator declines to settle, and payments stop.

**Control.** A fallback facilitator is configured by default and a 2-second
health check triggers failover. Self-hosting the fallback removes the dependency
on any single provider.

Owner: `protocol`.

### Nonce replay — LOW

EIP-3009 nonces are random 32-byte values generated fresh per payment. Collision
probability is negligible and the standard's own protections are sufficient.

## Key management

### Development

```bash
openssl rand -hex 32   # prefix with 0x
```

A throwaway key, funded with a few dollars of Base ETH for gas. Never a personal
wallet, never reused across environments.

### Production

Never a raw key. Set `signer.mode` to `turnkey` or `lit`, provision a signing
key with a per-session spend limit, and rotate on any suspicion.

`config:check --env production` enforces this, so an unsafe production
configuration fails a check rather than shipping quietly.

### Secrets

- `.env.local` and `config/anyx.config.jsonc` are git-ignored. Keep it that way.
- Every value marked `secret` in the registry is masked in all CLI output. A
  credential appearing in full anywhere is a bug worth reporting.
- CI runs a secret scan that is deliberately **not** `continue-on-error`: a
  committed signing key is worse than a broken build.
- Separate credentials per environment. A staging key that can move mainnet
  funds defeats the purpose of staging.

If a key is ever committed: rotate first, then remove it, then rewrite the
history that contains it. In that order — the rotation is what actually protects
you.

## Smart contracts

Not audited. Not deployed. Do not point them at mainnet funds.

Before mainnet:

- [ ] External audit with no unresolved critical or high findings
- [ ] Static analysis (Slither, Semgrep) clean or explicitly triaged
- [ ] Fork tests covering the full swap-and-pay path
- [ ] Adversarial slippage test proving a 100% revert rate
- [ ] `Ownable2Step` for every privileged role; multisig ownership
- [ ] Fee ceiling enforced in the contract, not only in configuration
- [ ] Deployed and exercised on Base Sepolia first
- [ ] Source verified on Basescan
- [ ] Bug bounty live

`sec.2-preflight-audit` in the task graph gates mainnet deployment on these, and
the audit sign-off is marked `manual` because no machine can attest to it.

## Reporting a vulnerability

Do not open a public issue for a security problem in a payment system. Report it
privately to the maintainers and allow time for a fix and a rotation before
disclosure.

## Further reading

- [`docs/reference/whitepaper.md`](reference/whitepaper.md) §6 — the full threat surface analysis
- [`docs/reference/prd.md`](reference/prd.md) §9 — risks and mitigations
- [`MASTER_PLAN.md`](../MASTER_PLAN.md) §7 — the risk register with owners
