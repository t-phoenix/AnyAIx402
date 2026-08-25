import type { AgentDefinition } from './types.ts';

export const growthAgent: AgentDefinition = {
  id: 'growth',
  name: 'Growth Engineer',
  domain: 'Go-to-market and monetization execution',
  mission:
    'Convert the monetization and low-hanging-fruit analyses into shipped artefacts: the day-one revenue path (Quote API plus USDT SDK), the pricing and spread configuration that actually collects the fee, and the distribution package that gets AnyX in front of the x402 and agent communities.',
  ownedPaths: ['growth/**'],
  capabilities: [
    'Encoding the pricing tiers and per-pair spreads as configuration',
    'Preparing launch assets: README, listings, launch posts, grant applications',
    'Instrumenting the metrics that prove the revenue model (volume routed, spread collected)',
    'Partner revenue share mechanics (20% of spread credited to referring partners)',
  ],
  requiredConfigKeys: [],
  requiredManualGates: ['npm-publish'],
  allowedCommands: ['bun run build', 'bun test'],
  definitionOfDone: [
    'Spread configuration matches the monetization table and is asserted by a test',
    'A $1 test payment collects the expected fee and it is visible in the receipt',
    'The distribution package is drafted: npm listing, awesome-x402 entry, launch post, grant applications',
    'Free/Pro/Enterprise limits are enforced by the API, not just documented',
  ],
  references: [
    'docs/reference/monetization-gtm.md',
    'docs/reference/low-hanging-fruit.md',
    'docs/reference/marketing-social.md',
    'docs/reference/market-research.md',
  ],
  domainRules: [
    'Revenue projections in the source documents are assumptions, not commitments. Never restate them as facts in shipped copy.',
    'The spread is the product. Any change to fee math needs a test and a docs update in the same change.',
    'Do not publish to a public channel from an automated run — draft the artefact and leave posting to a human.',
  ],
};
