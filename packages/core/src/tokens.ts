import type { Token } from "./types.ts";

export const BASE_CHAIN_ID = 8453;
export const ETHEREUM_CHAIN_ID = 1;
export const SOLANA_CHAIN_ID = 101;
export const LIGHTNING_CHAIN_ID = 0;

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const TOKEN_REGISTRY: Token[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: USDC_BASE,
    chainId: BASE_CHAIN_ID,
    decimals: 6,
    coingeckoId: "usd-coin",
    isNative: false,
    swapPath: "direct",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    chainId: BASE_CHAIN_ID,
    decimals: 6,
    coingeckoId: "tether",
    isNative: false,
    swapPath: "direct",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0x4200000000000000000000000000000000000006",
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    coingeckoId: "weth",
    isNative: false,
    swapPath: "direct",
  },
  {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    chainId: BASE_CHAIN_ID,
    decimals: 8,
    coingeckoId: "coinbase-wrapped-btc",
    isNative: false,
    swapPath: "direct",
  },
  {
    symbol: "ETH",
    name: "Ether",
    address: null,
    chainId: BASE_CHAIN_ID,
    decimals: 18,
    coingeckoId: "ethereum",
    isNative: true,
    swapPath: "direct",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    chainId: ETHEREUM_CHAIN_ID,
    decimals: 6,
    coingeckoId: "tether",
    isNative: false,
    swapPath: "bridge",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    chainId: ETHEREUM_CHAIN_ID,
    decimals: 8,
    coingeckoId: "wrapped-bitcoin",
    isNative: false,
    swapPath: "bridge",
  },
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    chainId: ETHEREUM_CHAIN_ID,
    decimals: 18,
    coingeckoId: "weth",
    isNative: false,
    swapPath: "bridge",
  },
  {
    symbol: "BTC",
    name: "Bitcoin (Lightning)",
    address: null,
    chainId: LIGHTNING_CHAIN_ID,
    decimals: 8,
    coingeckoId: "bitcoin",
    isNative: true,
    swapPath: "lightning",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    chainId: SOLANA_CHAIN_ID,
    decimals: 6,
    coingeckoId: "usd-coin",
    isNative: false,
    swapPath: "bridge",
  },
  {
    symbol: "SOL",
    name: "Solana",
    address: null,
    chainId: SOLANA_CHAIN_ID,
    decimals: 9,
    coingeckoId: "solana",
    isNative: true,
    swapPath: "bridge",
  },
];

export function getSupportedTokens(): Token[] {
  return TOKEN_REGISTRY;
}

export function getToken(symbol: string, chainId: number): Token | undefined {
  return TOKEN_REGISTRY.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase() && t.chainId === chainId,
  );
}

export function isSupported(address: string | null, chainId: number): boolean {
  if (address === null) {
    return TOKEN_REGISTRY.some((t) => t.address === null && t.chainId === chainId);
  }
  return TOKEN_REGISTRY.some(
    (t) =>
      t.address !== null &&
      t.address.toLowerCase() === address.toLowerCase() &&
      t.chainId === chainId,
  );
}

export function v0Tokens(): Token[] {
  return TOKEN_REGISTRY.filter((t) => t.chainId === BASE_CHAIN_ID);
}
