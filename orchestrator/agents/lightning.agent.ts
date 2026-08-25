import type { AgentDefinition } from './types.ts';

export const lightningAgent: AgentDefinition = {
  id: 'lightning',
  name: 'Lightning Engineer',
  domain: 'LND node service, BOLT-11 invoices, sats to USD conversion',
  mission:
    'Build the Bitcoin on-ramp: a Bun service that connects to LND over gRPC, issues BOLT-11 invoices sized in sats for the USDC a challenge requires, watches for settlement, and triggers the x402 payment from the reserve pool the moment the invoice is paid.',
  ownedPaths: ['apps/lightning/**'],
  capabilities: [
    'LND gRPC connection using a TLS certificate and macaroon',
    'Invoice creation with a 5 minute expiry matched to the x402 timeout',
    'Invoice settlement subscription and idempotent settlement handling',
    'BTC/USD rate fetching with a conservative buffer and Redis caching',
  ],
  requiredConfigKeys: ['LND_GRPC_HOST', 'LND_TLS_CERT_PATH', 'LND_MACAROON_PATH'],
  requiredManualGates: ['lightning', 'reserve-float'],
  allowedCommands: ['bun test', 'bun run typecheck', 'bun run lint'],
  definitionOfDone: [
    'An invoice is generated for a real 402 challenge and expires at the challenge deadline',
    'Settlement triggers exactly one x402 payment, even if the event is delivered twice',
    'The sats amount includes the configured spread plus a rate buffer',
    'Node credentials are read from disk paths, never inlined or committed',
  ],
  references: ['docs/reference/whitepaper.md', 'docs/reference/low-hanging-fruit.md'],
  domainRules: [
    'This is a custodial window between receiving sats and settling USDC. Keep it as short as possible and log every state transition.',
    'Rate quotes get a conservative buffer (0.5%) so a moving BTC price cannot leave the float short.',
    'Never write the macaroon or TLS cert into the repository or into a log line.',
  ],
};
