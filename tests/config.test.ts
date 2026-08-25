import { getConfig, getManualConfigRequirements } from '../src/config';

describe('Config & Manual Requirements Tests', () => {
  it('should load default configuration successfully', () => {
    const config = getConfig();
    expect(config).toBeDefined();
    expect(config.PORT).toBe(3000);
    expect(config.FEE_BPS).toBe(20);
    expect(config.RPC_URL_BASE).toBe('https://mainnet.base.org');
  });

  it('should expose manual configuration requirements for user configuration', () => {
    const reqs = getManualConfigRequirements();
    expect(Array.isArray(reqs)).toBe(true);
    expect(reqs.length).toBeGreaterThan(0);

    const categories = reqs.map(r => r.category);
    expect(categories).toContain('DEX Liquidity & Swaps');
    expect(categories).toContain('Blockchains & Signing');
    expect(categories).toContain('AI & LLM Services');
    expect(categories).toContain('Billing & Monetization');
  });
});
