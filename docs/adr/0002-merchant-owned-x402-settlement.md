# ADR 0002: Merchant-owned x402 verification and settlement

- Status: Proposed
- Date: 2026-08-25
- Decision owners: protocol specialist, lead architect, payments security
- Related: [D3](../DECISIONS_REQUIRED.md#d3-x402-version-and-settlement-ownership)

## Context

Historical inputs describe `X-PAYMENT`, direct facilitator settlement by AnyX, and then a retry
of the resource request
([AGENTS lines 353–397,443–474,509–517](../source/AGENTS.md#L353-L517)). That behavior is not a
safe implementation contract for current x402 v2 and risks confusing or duplicating settlement
ownership.

The current protocol must be pinned rather than reconstructed from August 2025 prose.

## Proposed decision

- Pin exact current x402 v2 client/server package versions and source commits.
- Use the standard `PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, and `PAYMENT-RESPONSE` wire schemas.
- Use CAIP-2 network and CAIP-19 asset identifiers.
- The AnyX payer client parses the challenge, constructs/signs the payment payload, and retries
  the resource request.
- Merchant x402 middleware owns facilitator verification and settlement.
- AnyX observes and validates the response/receipt; it does not call settlement independently.
- Facilitator failover is enabled only for equivalent, conformance-tested merchant behavior.

## Consequences

- Existing compliant merchants remain unchanged.
- AnyX must preserve the original request and safely replay it.
- The protocol adapter is versioned and isolated from routing/wallet code.
- Merchant/facilitator finality and response semantics become explicit state-machine events.
- Non-standard server-side multi-token `accepts` entries are excluded from MVP.

## Acceptance evidence

- Canonical fixture corpus for all three headers and supported error responses.
- Executable conformance test against a reference merchant and selected facilitator.
- Trace proving exactly one verify and one settle attempt under retries/timeouts.
- Invalid version, CAIP ID, recipient, amount, expiry, signature, and response tests.
- Compatibility manifest naming packages, commits, merchant, facilitator, network, and asset.

This ADR remains proposed until the conformance proof and owner approvals are complete.
