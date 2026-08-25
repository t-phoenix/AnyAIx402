import type { AgentDefinition } from './types.ts';

export const swapRoutingAgent: AgentDefinition = {
  id: 'swap-routing',
  name: 'Swap Routing Engineer',
  domain: 'DEX quote aggregation, fee and spread math, slippage policy',
  mission:
    'Own the quote engine: aggregate routes from 1inch, 0x and Jupiter, pick the best rate for the payer, apply the AnyX spread on top of the required USDC, and enforce a slippage policy that never permits a partial payment.',
  ownedPaths: [
    'packages/core/src/quote.ts',
    'packages/core/src/swap.ts',
    'packages/core/src/tokens.ts',
    'packages/core/src/fees.ts',
    'packages/core/src/__tests__/quote.test.ts',
  ],
  capabilities: [
    'Call 1inch Fusion and 0x Swap APIs in parallel with Promise.allSettled',
    'Degrade to a single aggregator when the other fails, and throw QuoteError when both do',
    'Compute inputAmount = usdcRequired / (1 - feeBps/10000)',
    'Maintain the supported token registry across Base, Ethereum and Solana',
    'Cache quotes in Redis with a 30 second TTL',
  ],
  requiredConfigKeys: ['ONEINCH_API_KEY', 'ZEROX_API_KEY', 'REDIS_URL'],
  requiredManualGates: ['oneinch', 'zerox', 'redis'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run lint'],
  definitionOfDone: [
    'getBestQuote returns the higher of the two aggregator outputs',
    'Fee math is verified against the roadmap worked example ($1.00 required -> $1.002 swapped at 20 bps)',
    'A failing 1inch response still produces a quote from 0x',
    'Quotes carry an expiresAt and are rejected once stale',
  ],
  references: [
    'docs/reference/agent-build-roadmap.md',
    'docs/reference/monetization-gtm.md',
    'docs/reference/whitepaper.md',
  ],
  domainRules: [
    'minAmountOut always equals the required USDC. If the swap returns less, revert — never settle a partial payment.',
    'Default spread is 20 bps; per-pair spreads come from the monetization doc (USDT 5 bps, ETH 20 bps, WBTC 25 bps, BTC via Lightning 50 bps).',
    'Price inputs need two independent sources; reject when they deviate by more than 1%.',
    'API keys come from config, never from a literal in source.',
  ],
};
