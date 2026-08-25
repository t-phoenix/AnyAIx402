import type { TaskDefinition } from './types.ts';

export const PHASE_4_TASKS: readonly TaskDefinition[] = [
  {
    id: '4.1-lightning',
    title: 'Lightning node service and BOLT-11 invoicing',
    phase: 4,
    agentId: 'lightning',
    summary:
      'Create apps/lightning as a Bun service connecting to LND over gRPC with a TLS certificate and macaroon. Implement LightningService with generateInvoice (sats computed from the required USDC plus spread divided by the BTC/USD rate, 5 minute expiry, persisted to lightning_invoices), watchInvoice (subscribe to settlement, front the payment from the reserve pool, mark the row paid) and getBtcUsdRate (CoinGecko, cached 60s in Redis, with a 0.5% conservative buffer). Add POST /v1/lightning/invoice and GET /v1/lightning/status/:paymentHash to the API.',
    dependsOn: ['3.2-reserve-pool'],
    ownedPaths: ['apps/lightning/**'],
    acceptanceCriteria: [
      {
        kind: 'file-exists',
        description: 'Lightning service exists',
        path: 'apps/lightning/src/index.ts',
      },
      {
        kind: 'file-contains',
        description: 'Invoice generation implemented',
        path: 'apps/lightning/src/index.ts',
        pattern: 'invoice',
      },
      { kind: 'command', description: 'Lightning tests pass', command: 'bun test apps/lightning' },
      {
        kind: 'manual',
        description:
          'A real BOLT-11 invoice was paid on a live node and settled the corresponding x402 payment',
      },
    ],
    verifyCommands: [{ command: 'bun test apps/lightning' }, { command: 'bun run typecheck' }],
    requiredConfigKeys: ['LND_GRPC_HOST', 'LND_TLS_CERT_PATH', 'LND_MACAROON_PATH'],
    requiredManualGates: ['lightning', 'reserve-float'],
    status: 'pending',
    priority: 40,
    estimatedComplexity: 'large',
    references: ['docs/reference/agent-build-roadmap.md#task-41--lightning-node-integration'],
  },
];
