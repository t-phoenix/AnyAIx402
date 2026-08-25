# @anyx/contracts

Solidity for the AnyX payment router.

> **Not audited. Not deployed. Do not point these at mainnet funds.**
> `sec.2-preflight-audit` in the task graph gates mainnet deployment on an
> external audit, and the sign-off is a manual criterion no machine can attest to.

## Contracts

| Contract | Purpose |
| --- | --- |
| `AnyXRouter` | Takes the payer's token, swaps it to USDC, settles the x402 payment |
| `SwapExecutor` | Aggregator call plus balance-delta verification (abstract base) |
| `FeeCollector` | Custody for the swap spread, with partner attribution |
| `ReservePool` | USDC float on Base that fronts cross-chain and Lightning payments |

## The two invariants

Everything in `AnyXRouter` exists to serve one of these:

1. **The recipient receives exactly what the x402 challenge asked for.** The
   AnyX fee is taken on top of that amount, never out of it.
2. **A partial payment is impossible.** If the swap yields less than the payment
   plus the fee, the whole transaction reverts and the payer keeps their tokens.

`testFuzz_swapAndPay_neverUnderpaysTheMerchant` asserts there is no third
outcome: across any swap rate, either the merchant receives the full amount or
they receive nothing.

## How a payment flows

```
payer                    AnyXRouter                 aggregator      USDC
  │                          │                           │            │
  │─ swapAndPay ────────────►│                           │            │
  │                          │─ validate the auth window │            │
  │                          │  and the nonce            │            │
  │                          │                           │            │
  │◄─ pull inputToken ───────│                           │            │
  │                          │─ approve + call ─────────►│            │
  │                          │◄─ USDC ───────────────────│            │
  │                          │─ measure the balance delta             │
  │                          │  revert if < required + fee            │
  │                          │                           │            │
  │                          │─ fee to FeeCollector ─────────────────►│
  │                          │─ transferWithAuthorization ───────────►│
  │                          │   (payer → payTo, signed off-chain)    │
  │◄─ refund proceeds ───────│                           │            │
```

The settlement transfer moves USDC **from the payer's own balance** via their
pre-signed EIP-3009 authorization, not from the router. That is why the router
refunds the entire swap output less the fee: those proceeds are what make the
payer whole for the payment they just authorized. Refunding only the surplus
above the required amount would strand `usdcRequired` in the contract on every
payment — a bug the test suite catches via `test_swapAndPay_leavesNoBalanceInTheRouter`.

## Security decisions worth knowing

**The router allowlist is not optional.** `SwapExecutor` makes a low-level call
with caller-supplied calldata. Without an allowlist that would let anyone make
this contract call anything.

**Swap output is measured, never trusted.** We do not parse the aggregator's
calldata — that is an unwinnable race against changing router ABIs. We measure
the USDC balance before and after and require the delta to clear the floor. A
malicious router cannot satisfy that without actually delivering the tokens.

**The fee ceiling is in code, not policy.** `MAX_FEE_BPS` is a constant at 1%.
Even a compromised owner key cannot set a predatory fee.

**Ownership transfer is two-step.** `Ownable2Step` throughout: a typo in an
address cannot orphan the contract or the treasury.

**Allowances are zeroed after every swap.** An aggregator that under-spends does
not get to keep the remainder approved.

## Working with them

```bash
forge build            # compile
forge test             # 28 tests including a fuzz run
forge test -vvv        # with traces
forge fmt              # format
forge build --sizes    # check against the 24KB limit
```

Dependencies live in `lib/` and are git-ignored. Install them with:

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge install foundry-rs/forge-std --no-git
```

## Deploying

Testnet first. Always.

```bash
export PRIVATE_KEY=0x...
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # Base Sepolia
export OWNER=0x...                                                # ideally a Safe

forge script script/Deploy.s.sol:Deploy \
  --rpc-url base_sepolia --broadcast --verify
```

Addresses are written to `deployments/<chainId>.json`.

The script deliberately stops after deployment. These steps are yours:

1. Allowlist your aggregator routers: `router.setRouterAllowed(router, true)`
2. Authorize the router on the pool: `reservePool.setSpenderAllowed(router, true)`
3. Fund the pool and call `depositFloat()`
4. Transfer ownership to a multisig, and accept it from that multisig
5. Set `ANYX_ROUTER`, `FEE_COLLECTOR` and `RESERVE_POOL` in `.env.local`

## Addresses

| Network | Chain | Router | FeeCollector | ReservePool |
| --- | --- | --- | --- | --- |
| Base Sepolia | 84532 | not deployed | not deployed | not deployed |
| Base | 8453 | not deployed | not deployed | not deployed |

## Before mainnet

- [ ] External audit, no unresolved critical or high findings
- [ ] Static analysis (Slither, Semgrep) clean or explicitly triaged
- [ ] Fork tests against real 1inch and 0x routers on Base
- [ ] Adversarial slippage testing showing a 100% revert rate
- [ ] Ownership held by a multisig, accepted from that multisig
- [ ] Source verified on Basescan
- [ ] Bug bounty live

See [`docs/security.md`](../../docs/security.md) for the full threat model.
