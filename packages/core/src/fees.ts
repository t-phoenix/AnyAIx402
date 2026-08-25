import { coreEnv } from './env.js';
import { ValidationError } from './errors.js';
import type { FeeBreakdown } from './types.js';

export const USDC_DECIMALS = 6;
export const BPS_DENOMINATOR = 10_000n;
/** Contract-level guard rail: AnyX never charges more than 1%. */
export const MAX_FEE_BPS = 100;

/**
 * Per-token spread from whitepaper §7. Values are basis points of the USDC the
 * x402 server requires.
 */
export const FEE_BPS_BY_SYMBOL: Readonly<Record<string, number>> = {
  USDC: 0,
  USDT: 5,
  ETH: 20,
  WETH: 20,
  WBTC: 50,
  cbBTC: 50,
  BTC: 50,
  SOL: 30,
};

export function defaultFeeBps(): number {
  return coreEnv.feeBps;
}

/** Spread for a token symbol, falling back to the configured default. */
export function getFeeBps(symbol?: string): number {
  if (!symbol) return defaultFeeBps();
  const match = Object.entries(FEE_BPS_BY_SYMBOL).find(
    ([key]) => key.toLowerCase() === symbol.toLowerCase(),
  );
  return match ? match[1] : defaultFeeBps();
}

export function minFeeUsdcAtomic(): bigint {
  return parseUsdc(coreEnv.minFeeUsdc.toFixed(USDC_DECIMALS));
}

export function parseUsdc(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new ValidationError(`Invalid USDC decimal amount: "${value}"`);
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  const paddedFraction = fraction.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(paddedFraction || '0');
}

/**
 * Accepts either a 6-decimal USDC string (`"1.000000"`) or an already-atomic
 * integer string (`"1000000"`). A value with a decimal point is treated as
 * human-readable USDC; a digits-only value is treated as atomic units.
 */
export function usdcToAtomic(value: string): bigint {
  const trimmed = value.trim();
  if (trimmed.includes('.')) return parseUsdc(trimmed);
  if (!/^\d+$/.test(trimmed)) {
    throw new ValidationError(`Invalid USDC amount: "${value}"`);
  }
  return BigInt(trimmed);
}

export function formatUsdc(atomic: bigint): string {
  const negative = atomic < 0n;
  const absolute = negative ? -atomic : atomic;
  const divisor = 10n ** BigInt(USDC_DECIMALS);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(USDC_DECIMALS, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function formatTokenAmount(atomic: bigint, decimals: number): string {
  if (decimals === 0) return atomic.toString();
  const negative = atomic < 0n;
  const absolute = negative ? -atomic : atomic;
  const divisor = 10n ** BigInt(decimals);
  const whole = absolute / divisor;
  const fraction = (absolute % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export function assertFeeBps(feeBps: number): void {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps >= 10_000) {
    throw new ValidationError(`feeBps must be an integer in [0, 10000), got ${feeBps}`);
  }
}

/**
 * Gross USDC the swap must produce so that, after AnyX keeps its spread, exactly
 * `usdcRequired` reaches the x402 recipient.
 *
 *   grossUsdc = usdcRequired / (1 - feeBps / 10000)
 *
 * Rounded up so rounding never eats into the amount owed to the API provider.
 */
export function grossUsdcRequired(usdcRequired: bigint, feeBps: number): bigint {
  assertFeeBps(feeBps);
  if (usdcRequired < 0n) throw new ValidationError('usdcRequired must be non-negative');
  if (feeBps === 0) return usdcRequired;
  return ceilDiv(usdcRequired * BPS_DENOMINATOR, BPS_DENOMINATOR - BigInt(feeBps));
}

export interface FeeBreakdownOptions {
  feeBps?: number;
  symbol?: string;
  /** Set to `false` to skip the `MIN_FEE_USDC` floor (used for display maths). */
  applyMinimum?: boolean;
}

export function computeFeeBreakdown(
  usdcRequired: bigint,
  options: FeeBreakdownOptions = {},
): FeeBreakdown {
  const feeBps = options.feeBps ?? getFeeBps(options.symbol);
  assertFeeBps(feeBps);

  let gross = grossUsdcRequired(usdcRequired, feeBps);
  let fee = gross - usdcRequired;

  if (options.applyMinimum !== false && usdcRequired > 0n) {
    const minimum = minFeeUsdcAtomic();
    if (fee < minimum) {
      fee = minimum;
      gross = usdcRequired + minimum;
    }
  }

  return {
    feeBps,
    usdcRequired: usdcRequired.toString(),
    feeUsdc: fee.toString(),
    usdcGross: gross.toString(),
  };
}

/** Fee taken when the spread is applied to an already-known gross amount. */
export function feeFromGross(gross: bigint, feeBps: number): bigint {
  assertFeeBps(feeBps);
  return (gross * BigInt(feeBps)) / BPS_DENOMINATOR;
}

/** Partner share of the AnyX fee for embedded integrations (roadmap Task 6.1). */
export const PARTNER_SHARE_BPS = 2_000;

export function partnerCredit(feeUsdc: bigint, shareBps: number = PARTNER_SHARE_BPS): bigint {
  if (!Number.isInteger(shareBps) || shareBps < 0 || shareBps > 10_000) {
    throw new ValidationError(`shareBps must be an integer in [0, 10000], got ${shareBps}`);
  }
  return (feeUsdc * BigInt(shareBps)) / BPS_DENOMINATOR;
}
