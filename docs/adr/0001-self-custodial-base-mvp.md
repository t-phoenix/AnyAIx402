# ADR 0001: Self-custodial Base MVP

- Status: Proposed
- Date: 2026-08-25
- Decision owners: product, payments architecture, security, legal
- Related: [D2](../DECISIONS_REQUIRED.md#d2-custody-and-signing)

## Context

The PRD makes non-custody a v1 non-goal boundary
([PRD lines 61–66](../source/x402-universal-adapter-prd.md#L61-L66), while other source flows use
a pre-funded USDC float and AnyX hot signer
([AGENTS lines 1232–1241](../source/AGENTS.md#L1232-L1241)). The proposed `/v1/pay` accepts only a
wallet address, which is not authorization to transfer assets
([AGENTS lines 509–517](../source/AGENTS.md#L509-L517)).

EIP-3009 authorization must be signed by the address named as `from`, and that address must hold
the USDC. A router that receives swap output cannot then submit an authorization from an
unfunded payer. A service signer changes the product into treasury-funded custody.

## Proposed decision

The MVP is self-custodial and Base-only:

1. The payer authorizes a qualified DEX swap.
2. Swap output is USDC sent to the payer address.
3. After confirmation, the payer signs EIP-3009 from that funded address.
4. The SDK submits the signature through the standard x402 paid-request flow.
5. AnyX never receives the payer private key and does not front payment inventory.

The first release may require a swap transaction plus typed-data signature. “One call” describes
SDK orchestration, not one atomic or prompt-free transaction.

## Consequences

- Preserves the intended unchanged-merchant and non-custodial boundary.
- Failure after swap leaves USDC with the payer and needs explicit recovery UX.
- User pays swap gas; very small payments may be uneconomic.
- Native ETH and token approvals require route-specific wallet handling.
- A custom router, reserve pool, Lightning, cross-chain inventory, and service signer are
  excluded from MVP.
- Future account abstraction can reduce prompts without silently changing custody.

## Acceptance evidence

- End-to-end Base Sepolia and capped Base mainnet tests.
- Value-flow diagram and balance assertions at every state.
- Typed-data domain/signature recovery tests.
- DEX recipient, allowance, calldata, min-output, and max-input tests.
- Crash/retry test proving no duplicate swap/payment.
- Legal confirmation that implemented flow matches disclosed custody model.

This ADR remains proposed until all owners approve it.
