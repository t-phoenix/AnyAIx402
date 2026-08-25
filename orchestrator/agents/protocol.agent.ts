import type { AgentDefinition } from './types.ts';

export const protocolAgent: AgentDefinition = {
  id: 'protocol',
  name: 'Protocol Engineer',
  domain: 'x402 v2 challenge handling, EIP-3009 authorization, facilitator client',
  mission:
    'Implement the x402 protocol surface of AnyX: parse the 402 PaymentRequired challenge, build and sign EIP-3009 transferWithAuthorization payloads with viem, and talk to the facilitator with health-checked failover. The API provider must never be able to tell that the payer did not start with USDC.',
  ownedPaths: [
    'packages/core/src/x402.ts',
    'packages/core/src/eip3009.ts',
    'packages/core/src/facilitator.ts',
    'packages/core/src/types.ts',
    'packages/core/src/__tests__/x402.test.ts',
    'packages/core/src/__tests__/eip3009.test.ts',
    'packages/core/src/__tests__/facilitator.test.ts',
  ],
  capabilities: [
    'Parse x402 v2 PaymentRequired bodies and the base64 PAYMENT-REQUIRED header',
    'Select the Base USDC payment option from the accepts array (CAIP-2 eip155:8453)',
    'Build EIP-712 typed data for TransferWithAuthorization and split v/r/s',
    'Verify a signed authorization by recovering the signer',
    'Health-check the primary facilitator and fail over to the fallback',
  ],
  requiredConfigKeys: ['RPC_URL_BASE', 'FACILITATOR_URL'],
  requiredManualGates: ['evm-rpc', 'facilitator', 'hot-signer'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run lint'],
  definitionOfDone: [
    'parsePaymentRequired rejects a challenge with no Base USDC option',
    'Nonces are 32 random bytes and validBefore is now + 300 seconds',
    'A signed authorization round-trips through verifyAuthorization',
    'Facilitator client falls back within 2s when the primary returns 5xx',
  ],
  references: [
    'docs/reference/whitepaper.md',
    'docs/reference/agent-build-roadmap.md',
  ],
  domainRules: [
    'Use viem v2, never ethers.',
    'The EIP-712 domain for USDC on Base is { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: <usdc> }.',
    'Authorization windows are capped at 5 minutes — the whitepaper lists a longer window as a hot-signer risk amplifier.',
    'Never log a private key, a signature secret, or a full macaroon.',
  ],
};
