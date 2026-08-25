import type { Token } from "./types.ts";

/** Default 0.20%. Pair-specific spreads from docs/anyx-llms.txt */
export function feeBpsForToken(token: Token, defaultBps = 20): number {
  if (token.swapPath === "lightning") return 50;
  if (token.swapPath === "bridge") return 30;
  switch (token.symbol) {
    case "USDT":
      return 5;
    case "ETH":
    case "WETH":
      return 20;
    case "WBTC":
    case "cbBTC":
      return 25;
    case "USDC":
      return 0;
    default:
      return defaultBps;
  }
}

/**
 * If the API costs `usdcRequired`, the payer must provide
 * usdcRequired / (1 - feeBps/10000) so AnyX keeps the spread.
 */
export function grossUsdcForFee(usdcRequired: number, feeBps: number): number {
  if (feeBps <= 0) return usdcRequired;
  return usdcRequired / (1 - feeBps / 10_000);
}

export function feeUsdc(usdcRequired: number, feeBps: number): number {
  return grossUsdcForFee(usdcRequired, feeBps) - usdcRequired;
}

export function formatUsdc(amount: number, digits = 6): string {
  return amount.toFixed(digits).replace(/\.?0+$/, (m) => (m.startsWith(".") ? m : ""));
}
