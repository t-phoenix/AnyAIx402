import { TOKEN_REGISTRY, getToken, getSupportedTokens } from '../src/core/tokens';
import { QuoteEngine } from '../src/core/quote';

describe('Token Registry & Quote Engine Tests', () => {
  const quoteEngine = new QuoteEngine();

  it('should contain supported tokens for Base, Aptos, Ethereum, Solana, and Lightning', () => {
    expect(TOKEN_REGISTRY.length).toBeGreaterThan(5);

    const eth = getToken('ETH', 8453);
    expect(eth).toBeDefined();
    expect(eth?.isNative).toBe(true);

    const apt = getToken('APT', 1000);
    expect(apt).toBeDefined();
    expect(apt?.symbol).toBe('APT');

    const btc = getToken('BTC_LN', 0);
    expect(btc).toBeDefined();
    expect(btc?.swapPath).toBe('lightning');
  });

  it('should generate accurate payment quotes with fee spread included', async () => {
    const quote = await quoteEngine.getQuote({
      endpointUrl: 'https://api.example.com/resource',
      inputToken: 'ETH',
      inputChainId: 8453
    }, '1.0');

    expect(quote).toBeDefined();
    expect(quote.quoteId).toBeDefined();
    expect(quote.usdcRequired).toBe('1.0');
    expect(parseFloat(quote.feeUsdc)).toBeCloseTo(0.002, 4); // 0.20% fee on 1.0 USDC
    expect(quote.expiresAt).toBeDefined();

    // Check cached quote retrieval
    const cached = quoteEngine.getCachedQuote(quote.quoteId);
    expect(cached).toBeDefined();
    expect(cached?.quoteId).toBe(quote.quoteId);
  });
});
