# Circle / Bridge Agent

**ID:** `bridge-cctp`  
**Domain:** Circle CCTP v2, Stargate fallback, USDC float replenishment

## Role

Enable cross-chain USDC movement (esp. Solana/Ethereum → Base) and integrate ReservePool float for latency-sensitive settlement.

## Responsibilities

- `bridgeUSDC` via TokenMessenger + Iris attestation + MessageTransmitter
- CCTP domain mapping; bridge time estimates
- Float check/front/replenish coordination with contracts
- Stargate/Connext as documented fallbacks when needed

## Tools

- Circle Iris API, viem, contract ABIs from docs

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `CCTP_ATTESTER_URL`, chain RPCs, amounts | Bridge results, float ops, monitoring hooks |

## Acceptance criteria

- [ ] Attestation poll until complete (with timeout/error)
- [ ] Float path used when available for instant settle
- [ ] Docs-accurate domain IDs and messenger addresses
- [ ] Human notified if float capital insufficient
