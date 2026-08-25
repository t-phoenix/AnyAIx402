import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === undefined || value === null) return undefined;
  return value;
};

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const optionalHexKey = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .optional(),
);

export const anyxConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  stubPayments: z.preprocess((v) => {
    if (v === undefined || v === "") return true;
    if (typeof v === "boolean") return v;
    return String(v).toLowerCase() !== "false";
  }, z.boolean()),
  publicUrl: z.string().default("http://localhost:3000"),

  databaseUrl: optionalUrl,
  redisUrl: optionalUrl,

  rpcUrlBase: z.string().url().default("https://mainnet.base.org"),
  rpcUrlBaseSepolia: optionalUrl,
  rpcUrlEthereum: optionalUrl,
  rpcUrlSolana: optionalUrl,

  privateKey: optionalHexKey,

  oneInchApiKey: optionalString,
  zeroXApiKey: optionalString,

  facilitatorUrl: z.string().url().default("https://api.cdp.coinbase.com/platform/v2/x402"),
  facilitatorFallbackUrl: optionalUrl,
  cdpApiKeyName: optionalString,
  cdpApiKeyPrivateKey: optionalString,

  cctpAttesterUrl: z.string().url().default("https://iris-api.circle.com"),

  feeBps: z.coerce.number().int().min(0).max(100).default(20),
  minFeeUsdc: z.coerce.number().min(0).default(0.001),

  usdcBase: z.string().default("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  anyxRouter: optionalString,
  feeCollector: optionalString,

  apiSecret: optionalString,

  stripeSecretKey: optionalString,
  stripeWebhookSecret: optionalString,
  stripeProPriceId: optionalString,

  coinGeckoApiKey: optionalString,

  openaiApiKey: optionalString,
  openaiModel: z.string().default("gpt-4o-mini"),
  anthropicApiKey: optionalString,
  anthropicModel: z.string().default("claude-sonnet-4-20250514"),

  lndTlsCertPath: optionalString,
  lndMacaroonPath: optionalString,
  lndGrpcHost: optionalString,

  paymentWebhookUrl: optionalUrl,
  paymentWebhookSecret: optionalString,
});

export type AnyxConfig = z.infer<typeof anyxConfigSchema>;

export type ConfigField = {
  env: string;
  path: keyof AnyxConfig;
  group: ConfigGroupId;
  label: string;
  hint: string;
  requiredFor: Capability[];
};

export type ConfigGroupId =
  | "app"
  | "data"
  | "chain"
  | "signer"
  | "dex"
  | "x402"
  | "circle"
  | "fees"
  | "billing"
  | "mas"
  | "lightning"
  | "webhooks";

export type Capability =
  | "api"
  | "quote_stub"
  | "quote_live"
  | "pay_stub"
  | "pay_live"
  | "persist"
  | "rate_limit"
  | "mas_llm"
  | "lightning"
  | "billing"
  | "cctp";

export const CONFIG_FIELDS: ConfigField[] = [
  {
    env: "PORT",
    path: "port",
    group: "app",
    label: "API port",
    hint: "Local port for the AnyX API (default 3000).",
    requiredFor: ["api"],
  },
  {
    env: "ANYX_STUB_PAYMENTS",
    path: "stubPayments",
    group: "app",
    label: "Simulate payments",
    hint: "Keep true until a funded USDC signer is ready.",
    requiredFor: ["pay_stub"],
  },
  {
    env: "DATABASE_URL",
    path: "databaseUrl",
    group: "data",
    label: "Postgres connection",
    hint: "Leave empty to store quotes in memory. docker compose provides postgresql://anyx:anyx@localhost:5432/anyx",
    requiredFor: ["persist"],
  },
  {
    env: "REDIS_URL",
    path: "redisUrl",
    group: "data",
    label: "Redis",
    hint: "Optional. Enables 30s quote cache and rate limits.",
    requiredFor: ["rate_limit"],
  },
  {
    env: "RPC_URL_BASE",
    path: "rpcUrlBase",
    group: "chain",
    label: "Base RPC URL",
    hint: "JSON-RPC endpoint for Base. Public https://mainnet.base.org works for demos.",
    requiredFor: ["quote_live", "pay_live"],
  },
  {
    env: "RPC_URL_ETHEREUM",
    path: "rpcUrlEthereum",
    group: "chain",
    label: "Ethereum RPC URL",
    hint: "Phase 2. Needed when paying with tokens that live on Ethereum.",
    requiredFor: ["cctp"],
  },
  {
    env: "RPC_URL_SOLANA",
    path: "rpcUrlSolana",
    group: "chain",
    label: "Solana RPC URL",
    hint: "Phase 2. Needed for SOL / SPL → USDC then CCTP.",
    requiredFor: ["cctp"],
  },
  {
    env: "PRIVATE_KEY",
    path: "privateKey",
    group: "signer",
    label: "Hot signer private key",
    hint: "64-byte hex key starting with 0x. Signs USDC EIP-3009 payments. Must hold USDC on Base for live pay. Use a dedicated test wallet.",
    requiredFor: ["pay_live"],
  },
  {
    env: "ONEINCH_API_KEY",
    path: "oneInchApiKey",
    group: "dex",
    label: "1inch API key",
    hint: "Create a free key at portal.1inch.dev. Needed (with or instead of 0x) for live swap quotes.",
    requiredFor: ["quote_live"],
  },
  {
    env: "ZEROX_API_KEY",
    path: "zeroXApiKey",
    group: "dex",
    label: "0x API key",
    hint: "Create a key at dashboard.0x.org. Fallback / parallel quote source.",
    requiredFor: ["quote_live"],
  },
  {
    env: "FACILITATOR_URL",
    path: "facilitatorUrl",
    group: "x402",
    label: "Primary x402 facilitator",
    hint: "Default is Coinbase CDP. The adapter submits signed USDC authorizations here.",
    requiredFor: ["pay_live"],
  },
  {
    env: "FACILITATOR_FALLBACK_URL",
    path: "facilitatorFallbackUrl",
    group: "x402",
    label: "Fallback facilitator",
    hint: "Used if the primary returns 5xx or times out (2 seconds).",
    requiredFor: ["pay_live"],
  },
  {
    env: "CCTP_ATTESTER_URL",
    path: "cctpAttesterUrl",
    group: "circle",
    label: "Circle Iris / CCTP attester",
    hint: "Phase 2 cross-chain USDC. Default https://iris-api.circle.com is correct for production.",
    requiredFor: ["cctp"],
  },
  {
    env: "FEE_BPS",
    path: "feeBps",
    group: "fees",
    label: "Default swap spread (basis points)",
    hint: "20 = 0.20%. USDT uses 5 bps, ETH 20, BTC-LN 50. Max 100 (1%).",
    requiredFor: ["api"],
  },
  {
    env: "API_SECRET",
    path: "apiSecret",
    group: "app",
    label: "Admin API secret",
    hint: "Protects key-management routes. Generate a long random string before exposing the API.",
    requiredFor: ["billing"],
  },
  {
    env: "STRIPE_SECRET_KEY",
    path: "stripeSecretKey",
    group: "billing",
    label: "Stripe secret key",
    hint: "Phase 6 Pro plan ($49/mo). Not needed for swap-spread revenue.",
    requiredFor: ["billing"],
  },
  {
    env: "OPENAI_API_KEY",
    path: "openaiApiKey",
    group: "mas",
    label: "OpenAI API key",
    hint: "Optional. Lets the orchestrator use an LLM for planning. Deterministic agent tools always run.",
    requiredFor: ["mas_llm"],
  },
  {
    env: "ANTHROPIC_API_KEY",
    path: "anthropicApiKey",
    group: "mas",
    label: "Anthropic API key",
    hint: "Optional alternative to OpenAI for MAS planning.",
    requiredFor: ["mas_llm"],
  },
  {
    env: "LND_MACAROON_PATH",
    path: "lndMacaroonPath",
    group: "lightning",
    label: "LND macaroon path",
    hint: "Phase 3 Bitcoin Lightning gateway. Skip until you run an LND node.",
    requiredFor: ["lightning"],
  },
  {
    env: "PAYMENT_WEBHOOK_URL",
    path: "paymentWebhookUrl",
    group: "webhooks",
    label: "Payment webhook URL",
    hint: "Optional HTTPS endpoint we POST when a payment settles.",
    requiredFor: [],
  },
];

export const CONFIG_GROUPS: Record<ConfigGroupId, { title: string; blurb: string }> = {
  app: {
    title: "App",
    blurb: "How the AnyX API runs on your machine or server.",
  },
  data: {
    title: "Database & cache",
    blurb: "Optional. Quotes work in memory without Postgres or Redis.",
  },
  chain: {
    title: "Blockchains",
    blurb: "RPC URLs. Base is enough for v0 (USDT and ETH on Base).",
  },
  signer: {
    title: "Payment wallet",
    blurb: "The wallet that holds USDC and signs x402 payments. Do not use your personal wallet.",
  },
  dex: {
    title: "Swap quotes (DEX)",
    blurb:
      "1inch and 0x tell us how much ETH/USDT a payment will cost. Without keys we use demo quotes.",
  },
  x402: {
    title: "x402 facilitator",
    blurb: "The service that submits USDC on Base after you sign. Coinbase CDP is the default.",
  },
  circle: {
    title: "Circle CCTP",
    blurb: "Cross-chain USDC later. Not required for Base-only payments.",
  },
  fees: {
    title: "Fees",
    blurb: "Transparent swap spread. 20 bps = 0.20%.",
  },
  billing: {
    title: "Pro billing (Stripe)",
    blurb: "Optional SaaS upgrade. Swap spread works without Stripe.",
  },
  mas: {
    title: "Multi-agent assistant",
    blurb: "Optional LLM keys. The agent loop still runs tests and checks without them.",
  },
  lightning: {
    title: "Bitcoin Lightning",
    blurb: "Phase 3. Ignore until you want BTC payers.",
  },
  webhooks: {
    title: "Webhooks",
    blurb: "Tell your own server when a payment settles.",
  },
};
