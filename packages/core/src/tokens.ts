import type { Token } from './types';

/**
 * Task 1.1 — Supported token registry.
 * chainId 0 is a special sentinel for Bitcoin Lightning (no EVM/Solana chain applies).
 * chainId 101 follows the common convention for Solana mainnet-beta used across the docs.
 */
export const TOKEN_REGISTRY: readonly Token[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: 8453,
    decimals: 6,
    coingeckoId: 'usd-coin',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    chainId: 8453,
    decimals: 6,
    coingeckoId: 'tether',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    chainId: 8453,
    decimals: 18,
    coingeckoId: 'weth',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    chainId: 8453,
    decimals: 8,
    coingeckoId: 'coinbase-wrapped-btc',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'ETH',
    name: 'Ether',
    address: null,
    chainId: 8453,
    decimals: 18,
    coingeckoId: 'ethereum',
    isNative: true,
    swapPath: 'direct',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: 1,
    decimals: 6,
    coingeckoId: 'tether',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    chainId: 1,
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    chainId: 1,
    decimals: 18,
    coingeckoId: 'weth',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin (Lightning)',
    address: null,
    chainId: 0,
    decimals: 8,
    coingeckoId: 'bitcoin',
    isNative: true,
    swapPath: 'lightning',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Solana)',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    chainId: 101,
    decimals: 6,
    coingeckoId: 'usd-coin',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    address: null,
    chainId: 101,
    decimals: 9,
    coingeckoId: 'solana',
    isNative: true,
    swapPath: 'bridge',
  },
] as const;

/**
 * Look up a token by symbol + chainId (case-insensitive symbol match).
 * Returns undefined if not found — callers decide whether that's an error.
 */
export function getToken(symbol: string, chainId: number): Token | undefined {
  const upper = symbol.toUpperCase();
  return TOKEN_REGISTRY.find((t) => t.symbol.toUpperCase() === upper && t.chainId === chainId);
}

/** Returns the full list of supported tokens. */
export function getSupportedTokens(): readonly Token[] {
  return TOKEN_REGISTRY;
}

/**
 * Returns true if `address` (or null for native assets) is a supported input token
 * on `chainId`. Address comparison is case-insensitive (EVM addresses aren't checksum-sensitive
 * here since we only care about registry membership, not signature verification).
 */
export function isSupported(address: string | null, chainId: number): boolean {
  return TOKEN_REGISTRY.some((t) => {
    if (t.chainId !== chainId) return false;
    if (address === null || t.address === null) return address === t.address;
    return t.address.toLowerCase() === address.toLowerCase();
  });
}
