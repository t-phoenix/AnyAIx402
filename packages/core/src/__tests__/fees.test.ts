import { describe, expect, test } from 'bun:test';
import {
  assertFeeBps,
  BPS_DENOMINATOR,
  computeFeeBreakdown,
  formatTokenAmount,
  formatUsdc,
  getFeeBps,
  grossUsdcRequired,
  MAX_FEE_BPS,
  minFeeUsdcAtomic,
  parseUsdc,
} from '../fees.js';

describe('grossUsdcRequired', () => {
  test('implements amount / (1 - feeBps/10000), not a naive percentage', () => {
    // The roadmap is specific: a $1.00 call at 20 bps means the payer supplies
    // $1.00 / 0.998 = $1.002004…, rounded up. Taking 20 bps *of* the payment
    // instead would leave AnyX slightly short of its own spread.
    const gross = grossUsdcRequired(1_000_000n, 20);
    expect(gross).toBe(1_002_005n);
  });

  test('rounds up, so rounding never eats into what the provider is owed', () => {
    const gross = grossUsdcRequired(1n, 20);
    expect(gross).toBeGreaterThan(1n);
  });

  test('a zero fee is a pass-through', () => {
    expect(grossUsdcRequired(1_000_000n, 0)).toBe(1_000_000n);
  });

  test('the gross always covers the payment', () => {
    for (const amount of [1n, 7n, 999n, 1_000_001n, 123_456_789n]) {
      for (const bps of [0, 5, 20, 50, 100]) {
        expect(grossUsdcRequired(amount, bps)).toBeGreaterThanOrEqual(amount);
      }
    }
  });

  test('rejects a negative amount', () => {
    expect(() => grossUsdcRequired(-1n, 20)).toThrow();
  });
});

describe('computeFeeBreakdown', () => {
  test('gross minus required always equals the fee', () => {
    for (const amount of [1_000_000n, 5_000_000n, 250_000n]) {
      const breakdown = computeFeeBreakdown(amount, { feeBps: 20 });
      expect(BigInt(breakdown.usdcGross) - BigInt(breakdown.usdcRequired)).toBe(
        BigInt(breakdown.feeUsdc),
      );
    }
  });

  test('the provider is always owed the untouched amount', () => {
    const breakdown = computeFeeBreakdown(1_000_000n, { feeBps: 50 });
    expect(breakdown.usdcRequired).toBe('1000000');
  });

  test('applies the minimum fee floor on a tiny payment', () => {
    // A 20 bps spread on a fraction of a cent rounds to almost nothing, so the
    // MIN_FEE_USDC floor is what keeps micropayments from being free to route.
    const breakdown = computeFeeBreakdown(1000n, { feeBps: 20 });
    expect(BigInt(breakdown.feeUsdc)).toBe(minFeeUsdcAtomic());
    expect(BigInt(breakdown.usdcGross)).toBe(1000n + minFeeUsdcAtomic());
  });

  test('the floor can be waived for display maths', () => {
    const breakdown = computeFeeBreakdown(1000n, { feeBps: 20, applyMinimum: false });
    expect(BigInt(breakdown.feeUsdc)).toBeLessThan(minFeeUsdcAtomic());
  });

  test('a large payment is above the floor and scales with the rate', () => {
    const cheap = computeFeeBreakdown(100_000_000n, { feeBps: 5 });
    const dear = computeFeeBreakdown(100_000_000n, { feeBps: 50 });
    expect(BigInt(dear.feeUsdc)).toBeGreaterThan(BigInt(cheap.feeUsdc));
  });

  test('resolves the rate from the token symbol when none is given', () => {
    const breakdown = computeFeeBreakdown(100_000_000n, { symbol: 'USDT' });
    expect(breakdown.feeBps).toBe(getFeeBps('USDT'));
  });

  test('a zero payment produces a zero fee rather than the floor', () => {
    const breakdown = computeFeeBreakdown(0n, { feeBps: 20 });
    expect(breakdown.feeUsdc).toBe('0');
  });
});

describe('assertFeeBps', () => {
  test('accepts the documented range', () => {
    for (const bps of [0, 5, 20, 50, 100, 9999]) {
      expect(() => assertFeeBps(bps)).not.toThrow();
    }
  });

  test('rejects 100% and above, which would leave the payer nothing', () => {
    expect(() => assertFeeBps(10_000)).toThrow();
  });

  test('rejects negative and non-integer rates', () => {
    expect(() => assertFeeBps(-1)).toThrow();
    expect(() => assertFeeBps(1.5)).toThrow();
  });
});

describe('per-token spreads', () => {
  test('stablecoin pairs are cheaper than volatile ones', () => {
    // Near-zero AMM slippage on a stable pair makes a tighter spread viable;
    // BTC carries the widest. Straight from the whitepaper's fee table.
    expect(getFeeBps('USDT')).toBeLessThan(getFeeBps('ETH'));
    expect(getFeeBps('ETH')).toBeLessThan(getFeeBps('BTC'));
  });

  test('symbol lookup is case-insensitive', () => {
    expect(getFeeBps('usdt')).toBe(getFeeBps('USDT'));
  });

  test('an unknown symbol falls back to the default rather than throwing', () => {
    const fee = getFeeBps('SOMETHING_UNLISTED');
    expect(fee).toBeGreaterThan(0);
    expect(fee).toBeLessThanOrEqual(MAX_FEE_BPS);
  });

  test('no configured spread exceeds the 1% ceiling the contract enforces', () => {
    for (const symbol of ['USDT', 'USDC', 'ETH', 'WETH', 'WBTC', 'cbBTC', 'SOL', 'BTC']) {
      expect(getFeeBps(symbol)).toBeLessThanOrEqual(MAX_FEE_BPS);
    }
  });
});

describe('amount formatting', () => {
  test('round-trips USDC through parse and format', () => {
    for (const value of ['0.000001', '1.000000', '1234.567890']) {
      expect(formatUsdc(parseUsdc(value))).toBe(value);
    }
  });

  test('parseUsdc rejects anything that is not a decimal amount', () => {
    for (const bad of ['', 'abc', '1.2.3', '-1', '1e6']) {
      expect(() => parseUsdc(bad)).toThrow();
    }
  });

  test('parseUsdc truncates beyond six decimals rather than rounding up', () => {
    expect(parseUsdc('1.0000009')).toBe(1_000_000n);
  });

  test('formatTokenAmount trims trailing zeros', () => {
    expect(formatTokenAmount(1_000_000_000_000_000_000n, 18)).toBe('1');
    expect(formatTokenAmount(421_400_000_000_000n, 18)).toBe('0.0004214');
  });

  test('formatTokenAmount handles zero-decimal tokens', () => {
    expect(formatTokenAmount(42n, 0)).toBe('42');
  });

  test('BPS_DENOMINATOR is 10000 as a bigint, for exact integer maths', () => {
    expect(BPS_DENOMINATOR).toBe(10_000n);
  });
});
