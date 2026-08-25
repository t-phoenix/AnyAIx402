/**
 * Circle CCTP v2 helper stubs (Phase 2).
 * Domain IDs: Ethereum=0, Avalanche=1, Optimism=2, Arbitrum=3, Solana=5, Base=6, Polygon=7
 */
export function getCCTPDomain(chainId: number): number {
  switch (chainId) {
    case 1:
      return 0;
    case 43114:
      return 1;
    case 10:
      return 2;
    case 42161:
      return 3;
    case 101:
      return 5;
    case 8453:
      return 6;
    case 137:
      return 7;
    default:
      throw new Error(`No CCTP domain for chain ${chainId}`);
  }
}

export function estimateBridgeTime(sourceChain: number, destChain: number): number {
  if (sourceChain === destChain) return 0;
  if ((sourceChain === 8453 && destChain === 1) || (sourceChain === 1 && destChain === 8453)) {
    return 15 * 60;
  }
  return 10 * 60;
}

export async function bridgeUSDC(): Promise<never> {
  throw new Error("Circle CCTP bridging is Phase 2 — not implemented in v0");
}
