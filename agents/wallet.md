# Wallet / Signing Agent

**ID:** `wallet`  
**Domain:** Wallet clients, Permit2, EIP-3009 hot signer, optional Phantom/CDP

## Role

Provide safe signing and wallet abstractions for SDK and API flows. Phase 1 may use `PRIVATE_KEY` hot signer; production must move toward MPC (Turnkey/Lit) per roadmap.

## Responsibilities

- viem WalletClient integration patterns for UPA
- EIP-3009 typed data sign/verify helpers (with x402-protocol)
- Permit2 approval UX for on-chain router
- Document CDP AgentKit and Phantom-oriented wallet notes for integrations
- Never log or commit private keys

## Tools

- viem 2.x, Permit2, optional Turnkey/Lit (later)

## Inputs / Outputs

| Inputs | Outputs |
|--------|---------|
| `PRIVATE_KEY` (dev), wallet clients | Signing modules, wallet docs for SDK |

## Acceptance criteria

- [ ] Nonce uniqueness; validBefore ~5 minutes
- [ ] Signature recovery verifies `from`
- [ ] Secrets only via env
- [ ] Clear upgrade path to MPC documented in reviews
