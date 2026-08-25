import type { Phase } from '../shared/types.ts';

/**
 * A ManualGate is anything a human must physically go and do: sign up somewhere,
 * fund a wallet, provision a node. The orchestrator never attempts to satisfy one
 * itself — it stops in front of the gate and prints exactly what to paste where.
 */
export interface ManualGate {
  readonly id: string;
  readonly title: string;
  /** Why the build cannot proceed without it. */
  readonly why: string;
  /** Task ids that cannot run until this gate is satisfied. */
  readonly blocks: readonly string[];
  /** Environment variable names, all of which must be non-empty unless optional. */
  readonly configKeys: readonly string[];
  /** Keys that improve the gate but are not required for it to count as satisfied. */
  readonly optionalConfigKeys?: readonly string[];
  readonly signupUrl: string;
  /** Ordered, copy-pasteable steps. */
  readonly howToObtain: readonly string[];
  /**
   * Cheap command proving the credential actually works. Shell syntax; `${VAR}`
   * references are expanded from the resolved config env before running.
   */
  readonly verifyCommand?: string;
  readonly optional: boolean;
  readonly phase: Phase;
}

export const MANUAL_GATES: readonly ManualGate[] = [
  {
    id: 'evm-rpc',
    title: 'EVM RPC endpoints (Base + Ethereum)',
    why: 'Every EVM read, EIP-3009 signature verification, swap simulation, and contract deployment needs a JSON-RPC endpoint. The public defaults are rate-limited and will fail under test load.',
    blocks: ['1.4-eip3009', '1.5-facilitator', '2.1-anyx-router', '2.2-deploy-scripts'],
    configKeys: ['RPC_URL_BASE', 'RPC_URL_ETHEREUM'],
    optionalConfigKeys: ['RPC_URL_BASE_SEPOLIA'],
    signupUrl: 'https://dashboard.alchemy.com/',
    howToObtain: [
      'Create a free account at https://dashboard.alchemy.com/ (QuickNode or Infura work equally well).',
      'Create one app on Base Mainnet and one on Ethereum Mainnet; also create a Base Sepolia app for testnet deploys.',
      'Copy each HTTPS endpoint URL.',
      'Add to .env.local: RPC_URL_BASE=..., RPC_URL_ETHEREUM=..., RPC_URL_BASE_SEPOLIA=...',
    ],
    verifyCommand:
      'curl -fsS -X POST -H "content-type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}\' "${RPC_URL_BASE}" | grep -q 0x2105',
    optional: false,
    phase: 1,
  },
  {
    id: 'solana-rpc',
    title: 'Solana RPC endpoint',
    why: 'Jupiter quote verification and the Solana leg of the CCTP cross-chain flow read Solana state.',
    blocks: ['3.1-cctp'],
    configKeys: ['RPC_URL_SOLANA'],
    signupUrl: 'https://www.helius.dev/',
    howToObtain: [
      'Create a free account at https://www.helius.dev/ (or Triton / QuickNode).',
      'Create a mainnet-beta RPC endpoint and copy the HTTPS URL.',
      'Add to .env.local: RPC_URL_SOLANA=...',
    ],
    verifyCommand:
      'curl -fsS -X POST -H "content-type: application/json" -d \'{"jsonrpc":"2.0","id":1,"method":"getHealth"}\' "${RPC_URL_SOLANA}" | grep -q ok',
    optional: false,
    phase: 3,
  },
  {
    id: 'oneinch',
    title: '1inch Developer Portal API key',
    why: 'Primary DEX quote source for every EVM token to USDC. Without it the quote engine has only the 0x fallback and cannot compare routes.',
    blocks: ['1.2-quote-engine'],
    configKeys: ['ONEINCH_API_KEY'],
    signupUrl: 'https://portal.1inch.dev/',
    howToObtain: [
      'Sign in at https://portal.1inch.dev/ with a wallet or email.',
      'Open Dashboard > My API keys and create a key with Swap API access.',
      'Add to .env.local: ONEINCH_API_KEY=...',
    ],
    verifyCommand:
      'curl -fsS -H "Authorization: Bearer ${ONEINCH_API_KEY}" "https://api.1inch.dev/swap/v6.0/8453/tokens" -o /dev/null',
    optional: false,
    phase: 1,
  },
  {
    id: 'zerox',
    title: '0x Swap API key',
    why: 'Secondary DEX quote source and the fallback when 1inch is unavailable. The roadmap requires both so getBestQuote can pick the better rate.',
    blocks: ['1.2-quote-engine'],
    configKeys: ['ZEROX_API_KEY'],
    signupUrl: 'https://dashboard.0x.org/',
    howToObtain: [
      'Create an account at https://dashboard.0x.org/.',
      'Create an app and copy its API key (the free tier is sufficient for development).',
      'Add to .env.local: ZEROX_API_KEY=...',
    ],
    verifyCommand:
      'curl -fsS -H "0x-api-key: ${ZEROX_API_KEY}" -H "0x-version: v2" "https://api.0x.org/sources?chainId=8453" -o /dev/null',
    optional: false,
    phase: 1,
  },
  {
    id: 'coingecko',
    title: 'CoinGecko API key (optional)',
    why: 'USD pricing for GET /v1/tokens and the sats-per-USD conversion in the Lightning flow. The public endpoint works without a key but is aggressively rate-limited.',
    blocks: ['1.6-api-server', '4.1-lightning'],
    configKeys: [],
    optionalConfigKeys: ['COINGECKO_API_KEY'],
    signupUrl: 'https://www.coingecko.com/en/api/pricing',
    howToObtain: [
      'Optional. Without a key the free public endpoint is used at ~10-30 calls/min.',
      'For a Demo key, create an account at https://www.coingecko.com/en/api/pricing and open Developer Dashboard.',
      'Add to .env.local: COINGECKO_API_KEY=...',
    ],
    verifyCommand:
      'curl -fsS "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd" -o /dev/null',
    optional: true,
    phase: 1,
  },
  {
    id: 'facilitator',
    title: 'x402 facilitator credentials (Coinbase CDP) + fallback URL',
    why: 'The facilitator submits transferWithAuthorization on-chain. Coinbase CDP is the primary; a second facilitator is required so a single provider cannot censor settlement.',
    blocks: ['1.5-facilitator', '1.6-api-server'],
    configKeys: ['CDP_API_KEY_ID', 'CDP_API_KEY_SECRET', 'FACILITATOR_URL'],
    optionalConfigKeys: ['FACILITATOR_FALLBACK_URL'],
    signupUrl: 'https://portal.cdp.coinbase.com/',
    howToObtain: [
      'Create a Coinbase Developer Platform account at https://portal.cdp.coinbase.com/.',
      'Open API keys > Create API key (Secret API Key). Download the JSON once — it is not shown again.',
      'Add to .env.local: CDP_API_KEY_ID=..., CDP_API_KEY_SECRET=...',
      'Add FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402',
      'Pick a fallback (self-hosted qntx/facilitator, or https://x402.halowerk.com/facilitator) and set FACILITATOR_FALLBACK_URL.',
    ],
    verifyCommand: 'curl -fsS -m 5 "${FACILITATOR_URL}/supported" -o /dev/null',
    optional: false,
    phase: 1,
  },
  {
    id: 'hot-signer',
    title: 'Hot signer key or MPC provider for EIP-3009',
    why: 'AnyX signs the EIP-3009 authorization on the payer\'s behalf after the swap. The whitepaper rates hot signer compromise as a HIGH severity attack vector, so production must use MPC rather than a raw key.',
    blocks: ['1.4-eip3009', '1.6-api-server'],
    configKeys: ['PRIVATE_KEY'],
    optionalConfigKeys: ['TURNKEY_API_PUBLIC_KEY', 'TURNKEY_API_PRIVATE_KEY', 'TURNKEY_ORGANIZATION_ID', 'LIT_PKP_PUBLIC_KEY'],
    signupUrl: 'https://app.turnkey.com/',
    howToObtain: [
      'Development: generate a throwaway key with `openssl rand -hex 32` and prefix it with 0x. Fund it with a few dollars of Base ETH for gas. Never reuse a personal wallet key.',
      'Production: create a Turnkey organization at https://app.turnkey.com/ (or a Lit Protocol PKP) and provision a signing key with a per-session spend limit.',
      'Add to .env.local: PRIVATE_KEY=0x... (development) or the TURNKEY_* / LIT_* keys (production).',
      'Set a transaction limit on the signer session and keep the EIP-3009 validBefore window at 5 minutes.',
    ],
    optional: false,
    phase: 1,
  },
  {
    id: 'postgres',
    title: 'PostgreSQL database URL',
    why: 'Quotes, payments, API keys and Lightning invoices are persisted in Postgres via Drizzle. Migrations cannot run without it.',
    blocks: ['0.2-db-schema', '1.6-api-server', '6.1-api-keys-billing'],
    configKeys: ['DATABASE_URL'],
    signupUrl: 'https://neon.tech/',
    howToObtain: [
      'Local: run `docker compose up -d postgres` and use postgresql://anyx:anyx@localhost:5432/anyx.',
      'No Docker available: create a free Postgres at https://neon.tech/ or https://supabase.com/ and copy the pooled connection string.',
      'Add to .env.local: DATABASE_URL=postgresql://...',
    ],
    verifyCommand: 'psql "${DATABASE_URL}" -c "select 1" >/dev/null',
    optional: false,
    phase: 0,
  },
  {
    id: 'redis',
    title: 'Redis URL',
    why: 'Quote caching with a 30s TTL, per-key rate limiting, and monthly volume counters all live in Redis.',
    blocks: ['1.2-quote-engine', '1.6-api-server', '6.1-api-keys-billing'],
    configKeys: ['REDIS_URL'],
    signupUrl: 'https://upstash.com/',
    howToObtain: [
      'Local: run `docker compose up -d redis` and use redis://localhost:6379.',
      'No Docker available: create a free database at https://upstash.com/ and copy the redis:// connection string.',
      'Add to .env.local: REDIS_URL=redis://...',
    ],
    verifyCommand: 'redis-cli -u "${REDIS_URL}" ping | grep -q PONG',
    optional: false,
    phase: 0,
  },
  {
    id: 'reserve-float',
    title: 'USDC float / reserve pool funding wallet',
    why: 'Cross-chain and Lightning payments are fronted from a USDC float on Base while CCTP settles asynchronously. Without a funded pool those flows cannot settle inside the x402 maxTimeoutSeconds window.',
    blocks: ['3.2-reserve-pool', '4.1-lightning'],
    configKeys: ['RESERVE_POOL_FUNDING_ADDRESS'],
    optionalConfigKeys: ['RESERVE_POOL_ADDRESS', 'RESERVE_POOL_MIN_USDC'],
    signupUrl: 'https://www.coinbase.com/',
    howToObtain: [
      'Create or designate a wallet that will hold the Base USDC float. Use a multisig (Safe) for anything beyond testnet.',
      'Fund it with USDC on Base. The low-hanging-fruit analysis sizes the Lightning gateway float at $10K-$50K; start far smaller on testnet.',
      'Add to .env.local: RESERVE_POOL_FUNDING_ADDRESS=0x...',
      'After ReservePool.sol is deployed, set RESERVE_POOL_ADDRESS=0x... and deposit the float via depositFloat().',
    ],
    optional: false,
    phase: 3,
  },
  {
    id: 'lightning',
    title: 'LND node credentials',
    why: 'The Lightning gateway issues BOLT-11 invoices and subscribes to settlement events over LND gRPC. It needs a reachable node plus its TLS certificate and macaroon.',
    blocks: ['4.1-lightning'],
    configKeys: ['LND_GRPC_HOST', 'LND_TLS_CERT_PATH', 'LND_MACAROON_PATH'],
    signupUrl: 'https://voltage.cloud/',
    howToObtain: [
      'Fastest path: create a hosted node at https://voltage.cloud/ (free trial) and open the node dashboard.',
      'Download tls.cert and the admin (or invoice) macaroon; store them outside the repo, e.g. ~/.anyx/lnd/.',
      'Self-hosted alternative: run LND on a VPS and open port 10009 to the API host only.',
      'Add to .env.local: LND_GRPC_HOST=host:10009, LND_TLS_CERT_PATH=/abs/path/tls.cert, LND_MACAROON_PATH=/abs/path/admin.macaroon',
      'Open at least one well-connected channel with inbound liquidity before accepting payments.',
    ],
    verifyCommand: 'test -r "${LND_TLS_CERT_PATH}" && test -r "${LND_MACAROON_PATH}"',
    optional: false,
    phase: 4,
  },
  {
    id: 'stripe',
    title: 'Stripe account for the Pro plan',
    why: 'The $49/month Pro subscription is billed through Stripe Checkout, and the webhook drives the free/pro plan flag on API keys.',
    blocks: ['6.2-stripe'],
    configKeys: ['STRIPE_SECRET_KEY', 'STRIPE_PRO_PRICE_ID', 'STRIPE_WEBHOOK_SECRET'],
    signupUrl: 'https://dashboard.stripe.com/register',
    howToObtain: [
      'Create an account at https://dashboard.stripe.com/register and stay in Test mode while building.',
      'Developers > API keys: copy the Secret key (sk_test_...).',
      'Product catalog: create product "AnyX Pro" with a $49/month recurring price and copy the price id (price_...).',
      'Developers > Webhooks: add endpoint https://<your-api-host>/webhooks/stripe subscribed to checkout.session.completed, customer.subscription.deleted, invoice.payment_failed. Copy the signing secret (whsec_...).',
      'Add to .env.local: STRIPE_SECRET_KEY=..., STRIPE_PRO_PRICE_ID=..., STRIPE_WEBHOOK_SECRET=...',
      'For local webhook testing run: stripe listen --forward-to localhost:3000/webhooks/stripe',
    ],
    verifyCommand:
      'curl -fsS -u "${STRIPE_SECRET_KEY}:" "https://api.stripe.com/v1/prices?limit=1" -o /dev/null',
    optional: false,
    phase: 6,
  },
  {
    id: 'basescan',
    title: 'Basescan API key',
    why: 'Contract source verification on Base after deployment. Unverified contracts are a non-starter for a payment router users must trust.',
    blocks: ['2.2-deploy-scripts'],
    configKeys: ['BASESCAN_API_KEY'],
    signupUrl: 'https://basescan.org/myapikey',
    howToObtain: [
      'Create an account at https://basescan.org/register.',
      'Open https://basescan.org/myapikey and add a new API key token.',
      'Add to .env.local: BASESCAN_API_KEY=...',
      'Also add it as a GitHub Actions secret named BASESCAN_API_KEY.',
    ],
    verifyCommand:
      'curl -fsS "https://api.basescan.org/api?module=stats&action=ethprice&apikey=${BASESCAN_API_KEY}" | grep -q \'"status":"1"\'',
    optional: false,
    phase: 2,
  },
  {
    id: 'fly-deploy-token',
    title: 'Fly.io deploy token',
    why: 'The API is deployed to Fly.io by the deploy pipeline and by .github/workflows/deploy-api.yml. Without the token the deploy job skips.',
    blocks: ['devops.1-deploy-api', 'ci.1-github-actions'],
    configKeys: ['FLY_API_TOKEN'],
    optionalConfigKeys: ['FLY_APP_NAME'],
    signupUrl: 'https://fly.io/app/sign-up',
    howToObtain: [
      'Create an account at https://fly.io/app/sign-up and install flyctl (curl -L https://fly.io/install.sh | sh).',
      'Run `fly apps create anyx-api` (and anyx-api-staging).',
      'Run `fly tokens create deploy -a anyx-api` and copy the FlyV1 token.',
      'Add to .env.local: FLY_API_TOKEN=...',
      'Add the same value as GitHub Actions secret FLY_API_TOKEN (Settings > Secrets and variables > Actions).',
    ],
    verifyCommand: 'flyctl auth whoami >/dev/null',
    optional: false,
    phase: 'ci',
  },
  {
    id: 'npm-publish',
    title: 'npm publish token for @anyx/sdk',
    why: 'The launch checklist requires @anyx/sdk@0.1.0 on npm; publish-sdk.yml needs an automation token to run unattended on a v* tag.',
    blocks: ['1.7-sdk', 'growth.2-distribution'],
    configKeys: ['NPM_TOKEN'],
    signupUrl: 'https://www.npmjs.com/signup',
    howToObtain: [
      'Create an npm account at https://www.npmjs.com/signup and enable 2FA.',
      'Create the @anyx organization (or scope) so the package name is reserved.',
      'Access Tokens > Generate New Token > Automation (bypasses 2FA in CI).',
      'Add to .env.local: NPM_TOKEN=...',
      'Add the same value as GitHub Actions secret NPM_TOKEN.',
    ],
    verifyCommand: 'npm whoami --registry https://registry.npmjs.org >/dev/null',
    optional: false,
    phase: 5,
  },
];

const GATES_BY_ID = new Map<string, ManualGate>(MANUAL_GATES.map((gate) => [gate.id, gate]));

export function getGate(id: string): ManualGate | undefined {
  return GATES_BY_ID.get(id);
}

export function listGateIds(): readonly string[] {
  return MANUAL_GATES.map((gate) => gate.id);
}

export type GateState = 'satisfied' | 'missing' | 'waived';

export interface GateStatus {
  readonly gate: ManualGate;
  readonly state: GateState;
  readonly missingKeys: readonly string[];
  readonly presentKeys: readonly string[];
  readonly missingOptionalKeys: readonly string[];
}

export function evaluateGate(
  gate: ManualGate,
  env: Readonly<Record<string, string>>,
  waived: readonly string[] = [],
): GateStatus {
  const missingKeys: string[] = [];
  const presentKeys: string[] = [];
  for (const key of gate.configKeys) {
    const value = env[key];
    if (value === undefined || value.trim() === '') missingKeys.push(key);
    else presentKeys.push(key);
  }
  const missingOptionalKeys = (gate.optionalConfigKeys ?? []).filter((key) => {
    const value = env[key];
    return value === undefined || value.trim() === '';
  });

  const state: GateState = waived.includes(gate.id)
    ? 'waived'
    : missingKeys.length === 0
      ? 'satisfied'
      : 'missing';

  return { gate, state, missingKeys, presentKeys, missingOptionalKeys };
}

export function evaluateAllGates(
  env: Readonly<Record<string, string>>,
  waived: readonly string[] = [],
): readonly GateStatus[] {
  return MANUAL_GATES.map((gate) => evaluateGate(gate, env, waived));
}

/** A gate blocks work only when it is required, unsatisfied, and not waived. */
export function isGateBlocking(status: GateStatus): boolean {
  return status.state === 'missing' && !status.gate.optional;
}

export function unsatisfiedGateIds(
  env: Readonly<Record<string, string>>,
  waived: readonly string[] = [],
): readonly string[] {
  return evaluateAllGates(env, waived)
    .filter(isGateBlocking)
    .map((status) => status.gate.id);
}
