import { z } from 'zod';

export const TokenSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  chainId: z.number(),
  decimals: z.number(),
  coingeckoId: z.string(),
  isNative: z.boolean(),
  swapPath: z.enum(['direct', 'bridge', 'lightning'])
});

export type Token = z.infer<typeof TokenSchema>;

export const TOKEN_REGISTRY: Token[] = [
  // Base (chainId 8453)
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    chainId: 8453,
    decimals: 6,
    coingeckoId: 'usd-coin',
    isNative: false,
    swapPath: 'direct'
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    chainId: 8453,
    decimals: 6,
    coingeckoId: 'tether',
    isNative: false,
    swapPath: 'direct'
  },
  {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    address: '0x4200000000000000000000000000000000000006',
    chainId: 8453,
    decimals: 18,
    coingeckoId: 'weth',
    isNative: false,
    swapPath: 'direct'
  },
  {
    symbol: 'ETH',
    name: 'Ether (Native)',
    address: null,
    chainId: 8453,
    decimals: 18,
    coingeckoId: 'ethereum',
    isNative: true,
    swapPath: 'direct'
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    chainId: 8453,
    decimals: 8,
    coingeckoId: 'coinbase-wrapped-btc',
    isNative: false,
    swapPath: 'direct'
  },
  // Ethereum Mainnet (chainId 1)
  {
    symbol: 'USDT',
    name: 'Tether USD (Ethereum)',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    chainId: 1,
    decimals: 6,
    coingeckoId: 'tether',
    isNative: false,
    swapPath: 'bridge'
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped BTC (Ethereum)',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    chainId: 1,
    decimals: 8,
    coingeckoId: 'wrapped-bitcoin',
    isNative: false,
    swapPath: 'bridge'
  },
  // Aptos (chainId 1000)
  {
    symbol: 'APT',
    name: 'Aptos Native Token',
    address: '0x1::aptos_coin::AptosCoin',
    chainId: 1000,
    decimals: 8,
    coingeckoId: 'aptos',
    isNative: true,
    swapPath: 'bridge'
  },
  {
    symbol: 'USDC_APTOS',
    name: 'USDC on Aptos (LayerZero / Native)',
    address: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
    chainId: 1000,
    decimals: 6,
    coingeckoId: 'usd-coin',
    isNative: false,
    swapPath: 'direct'
  },
  // Solana (chainId 101)
  {
    symbol: 'SOL',
    name: 'Solana Native',
    address: null,
    chainId: 101,
    decimals: 9,
    coingeckoId: 'solana',
    isNative: true,
    swapPath: 'bridge'
  },
  // Bitcoin Lightning (chainId 0)
  {
    symbol: 'BTC_LN',
    name: 'Bitcoin Lightning',
    address: null,
    chainId: 0,
    decimals: 8,
    coingeckoId: 'bitcoin',
    isNative: true,
    swapPath: 'lightning'
  }
];

export function getToken(symbol: string, chainId: number): Token | undefined {
  return TOKEN_REGISTRY.find(t => t.symbol.toUpperCase() === symbol.toUpperCase() && t.chainId === chainId);
}

export function getSupportedTokens(chainId?: number): Token[] {
  if (chainId !== undefined) {
    return TOKEN_REGISTRY.filter(t => t.chainId === chainId);
  }
  return [...TOKEN_REGISTRY];
}
