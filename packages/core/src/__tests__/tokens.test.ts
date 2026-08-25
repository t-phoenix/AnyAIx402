import { describe, expect, it } from 'vitest';
import { TOKEN_REGISTRY, getSupportedTokens, getToken, isSupported } from '../tokens';

describe('tokens registry', () => {
  it('exposes at least the 11 tokens documented in AGENTS.md Task 1.1', () => {
    expect(TOKEN_REGISTRY.length).toBeGreaterThanOrEqual(11);
  });

  it('getToken finds USDC on Base by symbol + chainId', () => {
    const token = getToken('usdc', 8453);
    expect(token).toBeDefined();
    expect(token?.address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(token?.decimals).toBe(6);
  });

  it('getToken is case-insensitive on symbol', () => {
    expect(getToken('eth', 8453)?.symbol).toBe('ETH');
    expect(getToken('ETH', 8453)?.symbol).toBe('ETH');
  });

  it('getToken returns undefined for unknown token/chain combos', () => {
    expect(getToken('DOGE', 8453)).toBeUndefined();
    expect(getToken('USDC', 999_999)).toBeUndefined();
  });

  it('getSupportedTokens returns the full registry', () => {
    expect(getSupportedTokens()).toBe(TOKEN_REGISTRY);
  });

  it('isSupported matches a known ERC-20 address on the right chain (case-insensitive)', () => {
    expect(isSupported('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 8453)).toBe(true);
    expect(isSupported('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 8453)).toBe(true);
  });

  it('isSupported returns false for a known address on the wrong chain', () => {
    expect(isSupported('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 1)).toBe(false);
  });

  it('isSupported matches native assets via null address', () => {
    expect(isSupported(null, 8453)).toBe(true); // native ETH on Base
    expect(isSupported(null, 101)).toBe(true); // native SOL
    expect(isSupported(null, 1)).toBe(false); // no native entry for chainId 1
  });

  it('includes the BTC Lightning sentinel entry', () => {
    const btc = getToken('BTC', 0);
    expect(btc).toBeDefined();
    expect(btc?.swapPath).toBe('lightning');
    expect(btc?.isNative).toBe(true);
  });
});
