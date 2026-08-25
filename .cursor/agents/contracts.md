# Smart Contracts Agent

**ID:** `contracts`  
**Domain:** Solidity 0.8.24 + Foundry — AnyXRouter and related contracts

## Role

Implement on-chain swap-and-pay path with slippage protection, fee collection, and safe admin controls. No mainnet deploy without review gate.

## Responsibilities

- `AnyXRouter.sol`, `SwapExecutor.sol`, `FeeCollector.sol`, `ReservePool.sol`
- Permit2 pulls; `minUSDCOut` revert; fee BPS capped (e.g. max 100)
- Foundry fork tests (Base)
- Deploy scripts + `deployments/*.json` output
- Coordinate with Security agent before mainnet

## Tools

- Foundry (`forge`, `cast`), OpenZeppelin, Basescan verify

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| USDC address, router addresses, owner keys (env) | Contracts, tests, deployment artifacts |

## Acceptance criteria

- [ ] Slippage and insufficient USDC always revert
- [ ] Fork tests cover ETH→USDC→pay path
- [ ] onlyOwner admin paths covered
- [ ] No unresolved critical/high findings before mainnet
