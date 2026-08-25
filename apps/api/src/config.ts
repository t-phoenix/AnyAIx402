function read(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function readInt(key: string, fallback: number): number {
  const raw = read(key);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export interface ApiConfig {
  readonly port: number;
  readonly version: string;
  readonly corsAllowedOrigins: readonly string[];
  readonly databaseUrl: string | undefined;
  readonly redisUrl: string | undefined;
  readonly oneInchApiKey: string | undefined;
  readonly zeroExApiKey: string | undefined;
  readonly coingeckoApiKey: string | undefined;
  readonly facilitatorUrl: string | undefined;
  readonly facilitatorFallbackUrl: string | undefined;
  readonly signerPrivateKey: string | undefined;
  readonly apiSecret: string | undefined;
  readonly feeBps: number;
  readonly defaultSlippageBps: number;
  readonly quoteTtlSeconds: number;
  readonly rateLimitFreeRpm: number;
  readonly rateLimitProRpm: number;
  readonly floatUsdc: string | undefined;
}

/**
 * Read once at startup. Every credential is optional: a missing one disables a
 * capability and is reported at /health rather than preventing boot.
 *
 * `@anyx/config` is the eventual single source of truth for these names; the
 * keys here match its registry exactly.
 */
export function loadApiConfig(): ApiConfig {
  return {
    port: readInt('PORT', 3000),
    version: read('ANYX_VERSION') ?? '0.1.0',
    corsAllowedOrigins: (read('CORS_ALLOWED_ORIGINS') ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin !== ''),
    databaseUrl: read('DATABASE_URL'),
    redisUrl: read('REDIS_URL'),
    oneInchApiKey: read('ONEINCH_API_KEY'),
    zeroExApiKey: read('ZEROX_API_KEY'),
    coingeckoApiKey: read('COINGECKO_API_KEY'),
    facilitatorUrl: read('FACILITATOR_URL'),
    facilitatorFallbackUrl: read('FACILITATOR_FALLBACK_URL'),
    signerPrivateKey: read('PRIVATE_KEY'),
    apiSecret: read('API_SECRET'),
    feeBps: readInt('FEE_BPS', 20),
    defaultSlippageBps: readInt('DEFAULT_SLIPPAGE_BPS', 50),
    quoteTtlSeconds: readInt('QUOTE_CACHE_TTL_SECONDS', 30),
    rateLimitFreeRpm: readInt('RATE_LIMIT_FREE_RPM', 100),
    rateLimitProRpm: readInt('RATE_LIMIT_PRO_RPM', 1000),
    floatUsdc: read('FLOAT_POOL_BALANCE_USDC'),
  };
}

export type Capability =
  | 'evmQuotes'
  | 'settlement'
  | 'persistence'
  | 'quoteCache'
  | 'rateLimiting'
  | 'pricing'
  | 'lightning';

export interface CapabilityReport {
  readonly enabled: boolean;
  /** Stated when disabled, so /health explains itself without a lookup. */
  readonly reason?: string;
}

export function capabilities(config: ApiConfig): Record<Capability, CapabilityReport> {
  const hasDex = config.oneInchApiKey !== undefined || config.zeroExApiKey !== undefined;

  return {
    evmQuotes: hasDex
      ? { enabled: true }
      : { enabled: false, reason: 'set ONEINCH_API_KEY or ZEROX_API_KEY to enable DEX quotes' },
    settlement:
      config.signerPrivateKey !== undefined && config.facilitatorUrl !== undefined
        ? { enabled: true }
        : {
            enabled: false,
            reason: 'settlement needs both PRIVATE_KEY (or an MPC signer) and FACILITATOR_URL',
          },
    persistence:
      config.databaseUrl !== undefined
        ? { enabled: true }
        : { enabled: false, reason: 'DATABASE_URL is unset; receipts are held in memory only' },
    quoteCache:
      config.redisUrl !== undefined
        ? { enabled: true }
        : { enabled: false, reason: 'REDIS_URL is unset; quotes are cached in memory only' },
    rateLimiting:
      config.redisUrl !== undefined
        ? { enabled: true }
        : { enabled: false, reason: 'REDIS_URL is unset; rate limits are per-process only' },
    pricing: { enabled: true },
    lightning: { enabled: false, reason: 'the Lightning gateway is Phase 4 and not implemented' },
  };
}
