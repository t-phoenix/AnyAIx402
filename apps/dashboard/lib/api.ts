export const API_BASE_URL = process.env.NEXT_PUBLIC_ANYX_API_URL ?? 'http://localhost:3000';

export interface CapabilityReport {
  enabled: boolean;
  reason?: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  degraded: string[];
  capabilities: Record<string, CapabilityReport>;
  persistence: string;
  rateLimiter: string;
}

export interface Token {
  symbol: string;
  name: string;
  address: string | null;
  chainId: number;
  decimals: number;
  isNative: boolean;
  priceUsd: string | null;
}

export interface PaymentReceipt {
  receiptId: string;
  timestamp: string;
  endpoint: string;
  inputToken: string;
  inputAmount: string;
  apiCostUSDC: string;
  adapterFeeUSDC: string;
  txHash: string | null;
  status: 'pending' | 'settled' | 'failed';
}

/**
 * Every fetch here can fail, because the dashboard is expected to run against
 * an API that is not up yet. `null` means "could not reach it", which the pages
 * render as an explanation rather than an error boundary.
 */
async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getHealth(): Promise<HealthResponse | null> {
  return get<HealthResponse>('/health');
}

export async function getTokens(): Promise<Token[]> {
  const body = await get<{ tokens: Token[] }>('/v1/tokens');
  return body?.tokens ?? [];
}

export async function getReceipts(): Promise<PaymentReceipt[]> {
  const body = await get<{ receipts: PaymentReceipt[] }>('/v1/receipts');
  return body?.receipts ?? [];
}

export function chainName(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'Ethereum';
    case 8453:
      return 'Base';
    case 84532:
      return 'Base Sepolia';
    case 101:
      return 'Solana';
    case 0:
      return 'Bitcoin';
    default:
      return `Chain ${chainId}`;
  }
}
