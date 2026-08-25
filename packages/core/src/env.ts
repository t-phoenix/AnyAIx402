import { ConfigError } from './errors.js'

/**
 * Configuration access for `@anyx/core`.
 *
 * `@anyx/config` will become the single source of truth for typed configuration
 * across the monorepo. Until it lands, every package reads `process.env` through
 * a tiny local helper like this one so nothing depends on load order.
 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value.trim() === '' ? undefined : value.trim()
}

export function requireEnv(name: string): string {
  const value = readEnv(name)
  if (value === undefined) {
    throw new ConfigError(`Missing required environment variable: ${name}`, { variable: name })
  }
  return value
}

export function readIntEnv(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`Environment variable ${name} must be an integer, got "${raw}"`, {
      variable: name,
    })
  }
  return parsed
}

export function readFloatEnv(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (raw === undefined) return fallback
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`Environment variable ${name} must be a number, got "${raw}"`, {
      variable: name,
    })
  }
  return parsed
}

export const DEFAULT_FACILITATOR_URL = 'https://api.cdp.coinbase.com/platform/v2/x402'
export const DEFAULT_FACILITATOR_FALLBACK_URL = 'https://x402.halowerk.com/facilitator'
export const DEFAULT_RPC_URL_BASE = 'https://mainnet.base.org'
export const DEFAULT_RPC_URL_ETHEREUM = 'https://eth.llamarpc.com'
export const DEFAULT_RPC_URL_SOLANA = 'https://api.mainnet-beta.solana.com'
export const DEFAULT_CCTP_ATTESTER_URL = 'https://iris-api.circle.com'

/** Read lazily via getters so tests and runtime config changes are picked up. */
export const coreEnv = {
  get oneinchApiKey(): string | undefined {
    return readEnv('ONEINCH_API_KEY')
  },
  get zeroxApiKey(): string | undefined {
    return readEnv('ZEROX_API_KEY')
  },
  get facilitatorUrl(): string {
    return readEnv('FACILITATOR_URL') ?? DEFAULT_FACILITATOR_URL
  },
  get facilitatorFallbackUrl(): string | undefined {
    return readEnv('FACILITATOR_FALLBACK_URL')
  },
  get privateKey(): string | undefined {
    return readEnv('PRIVATE_KEY')
  },
  get cctpAttesterUrl(): string {
    return readEnv('CCTP_ATTESTER_URL') ?? DEFAULT_CCTP_ATTESTER_URL
  },
  get feeBps(): number {
    return readIntEnv('FEE_BPS', 20)
  },
  get minFeeUsdc(): number {
    return readFloatEnv('MIN_FEE_USDC', 0.001)
  },
  rpcUrl(chainId: number): string | undefined {
    switch (chainId) {
      case 8453:
        return readEnv('RPC_URL_BASE') ?? DEFAULT_RPC_URL_BASE
      case 1:
        return readEnv('RPC_URL_ETHEREUM') ?? DEFAULT_RPC_URL_ETHEREUM
      case 101:
        return readEnv('RPC_URL_SOLANA') ?? DEFAULT_RPC_URL_SOLANA
      default:
        return undefined
    }
  },
} as const
