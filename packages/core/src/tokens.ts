import type { Token } from './types.js'

export const CHAIN_ID_BASE = 8453
export const CHAIN_ID_ETHEREUM = 1
export const CHAIN_ID_SOLANA = 101
/** Bitcoin / Lightning has no EVM chain id; 0 is reserved for it in AnyX. */
export const CHAIN_ID_BITCOIN_LIGHTNING = 0

export const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const USDC_SOLANA_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'

export const TOKEN_REGISTRY: readonly Token[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: USDC_BASE_ADDRESS,
    chainId: CHAIN_ID_BASE,
    decimals: 6,
    coingeckoId: 'usd-coin',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    chainId: CHAIN_ID_BASE,
    decimals: 6,
    coingeckoId: 'tether',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    chainId: CHAIN_ID_BASE,
    decimals: 18,
    coingeckoId: 'weth',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    chainId: CHAIN_ID_BASE,
    decimals: 8,
    coingeckoId: 'coinbase-wrapped-btc',
    isNative: false,
    swapPath: 'direct',
  },
  {
    symbol: 'ETH',
    name: 'Ether',
    address: null,
    chainId: CHAIN_ID_BASE,
    decimals: 18,
    coingeckoId: 'ethereum',
    isNative: true,
    swapPath: 'direct',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: CHAIN_ID_ETHEREUM,
    decimals: 6,
    coingeckoId: 'tether',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    chainId: CHAIN_ID_ETHEREUM,
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    chainId: CHAIN_ID_ETHEREUM,
    decimals: 18,
    coingeckoId: 'weth',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin (Lightning)',
    address: null,
    chainId: CHAIN_ID_BITCOIN_LIGHTNING,
    decimals: 8,
    coingeckoId: 'bitcoin',
    isNative: true,
    swapPath: 'lightning',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin (Solana)',
    address: USDC_SOLANA_MINT,
    chainId: CHAIN_ID_SOLANA,
    decimals: 6,
    coingeckoId: 'usd-coin',
    isNative: false,
    swapPath: 'bridge',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    address: null,
    chainId: CHAIN_ID_SOLANA,
    decimals: 9,
    coingeckoId: 'solana',
    isNative: true,
    swapPath: 'bridge',
  },
] as const

const registryKey = (symbol: string, chainId: number): string =>
  `${symbol.toUpperCase()}:${chainId}`

const BY_SYMBOL_AND_CHAIN = new Map<string, Token>(
  TOKEN_REGISTRY.map((token) => [registryKey(token.symbol, token.chainId), token]),
)

const BY_ADDRESS_AND_CHAIN = new Map<string, Token>(
  TOKEN_REGISTRY.filter((token) => token.address !== null).map((token) => [
    registryKey(token.address as string, token.chainId),
    token,
  ]),
)

export function getToken(symbol: string, chainId: number): Token | undefined {
  return BY_SYMBOL_AND_CHAIN.get(registryKey(symbol, chainId))
}

export function getSupportedTokens(): readonly Token[] {
  return TOKEN_REGISTRY
}

export function isSupported(address: string | null, chainId: number): boolean {
  if (address === null) {
    return TOKEN_REGISTRY.some((token) => token.address === null && token.chainId === chainId)
  }
  return BY_ADDRESS_AND_CHAIN.has(registryKey(address, chainId))
}

export function getTokenByAddress(address: string, chainId: number): Token | undefined {
  return BY_ADDRESS_AND_CHAIN.get(registryKey(address, chainId))
}

export function getTokensForChain(chainId: number): readonly Token[] {
  return TOKEN_REGISTRY.filter((token) => token.chainId === chainId)
}

/** The settlement asset for every x402 payment AnyX routes. */
export function getSettlementToken(): Token {
  const usdc = getToken('USDC', CHAIN_ID_BASE)
  if (!usdc) throw new Error('Token registry is missing USDC on Base')
  return usdc
}

/**
 * DEX aggregators address native assets with the EIP-7528 sentinel rather than a
 * contract address.
 */
export const NATIVE_ASSET_SENTINEL = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export function toDexAssetAddress(token: Token): string {
  return token.address ?? NATIVE_ASSET_SENTINEL
}

export function oneWholeUnit(token: Token): string {
  return (10n ** BigInt(token.decimals)).toString()
}
