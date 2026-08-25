# AnyX contracts

Phase 2. Install [Foundry](https://book.getfoundry.sh/), then:

```bash
forge test -vvv
forge script script/Deploy.s.sol --rpc-url $RPC_URL_BASE_SEPOLIA --broadcast
```

v0 settlement uses a pre-funded USDC wallet (see `docs/PLAN.md`). Do not deploy `AnyXRouter` to mainnet without an audit.
