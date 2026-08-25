# @anyx/contracts (placeholder — Phase 2)

This package is **out of scope** for Phase 0/1 (Foundation + Core Engine MVP).

It will be owned by the **Smart Contract Agent** starting in **Phase 2** of the
[build roadmap](../../docs/AGENTS.md#phase-2-smart-contracts-week-46), which covers:

- `AnyXRouter.sol` — main entry point: pulls the payer's input token, swaps it to USDC via a
  DEX aggregator, and executes the EIP-3009 `transferWithAuthorization` settlement.
- `SwapExecutor.sol` — DEX aggregator interface (1inch AggregationRouterV6).
- `FeeCollector.sol` — extracts and forwards the AnyX swap-spread fee.
- `ReservePool.sol` — USDC float pool for instant cross-chain settlement (Phase 3).
- Foundry test suite (`forge test`), including a Base-mainnet fork test.
- Deployment scripts (`script/Deploy.s.sol`) targeting Base Sepolia first, then Base mainnet
  (mainnet deploys are always human-gated — see `docs/MULTI_AGENT_SYSTEM_PLAN.md` §3.7).

Phase 1 (this PR) intentionally uses an **off-chain USDC float** model instead of on-chain
swaps — see `docs/AGENTS.md` "Notes for Cursor Agents" #8 — so no smart contract risk is
introduced before the contracts here are written, tested, and audited.

Required env vars for this phase (see `docs/CONFIGURATION.md` Tier 2):
`BASESCAN_API_KEY`, `RPC_URL_BASE_SEPOLIA`.
