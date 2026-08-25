import { v4 as uuidv4 } from 'uuid';
import { PaymentQuote, PaymentRequired, PaymentRequiredSchema } from './types';
import { getToken, Token } from './tokens';
import { getConfig } from '../config';

export interface QuoteParams {
  endpointUrl: string;
  inputToken: string;
  inputChainId: number;
  slippageBps?: number;
}

export class QuoteEngine {
  private quoteCache: Map<string, { quote: PaymentQuote; createdAt: number }> = new Map();

  // Reference rates in USD
  private mockPriceFeeds: Record<string, number> = {
    'ETH': 2600.00,
    'WETH': 2600.00,
    'USDT': 1.00,
    'USDC': 1.00,
    'USDC_APTOS': 1.00,
    'APT': 8.50,
    'SOL': 145.00,
    'WBTC': 62000.00,
    'cbBTC': 62000.00,
    'BTC_LN': 62000.00
  };

  /**
   * Parse 402 challenge from an endpoint response
   */
  public parse402Challenge(data: any): PaymentRequired {
    return PaymentRequiredSchema.parse(data);
  }

  /**
   * Calculates best quote for an x402 payment
   */
  public async getQuote(params: QuoteParams, requiredUsdcAmount: string = '1.0'): Promise<PaymentQuote> {
    const cfg = getConfig();
    const token = getToken(params.inputToken, params.inputChainId);
    if (!token) {
      throw new Error(`Unsupported token: ${params.inputToken} on chain ${params.inputChainId}`);
    }

    const usdcReqNum = parseFloat(requiredUsdcAmount);
    const feeBps = cfg.FEE_BPS || 20; // 0.20%
    const feeUsdcNum = (usdcReqNum * feeBps) / 10000;
    const totalUsdcNeeded = usdcReqNum + feeUsdcNum;

    const tokenPrice = this.mockPriceFeeds[token.symbol] || 1.0;
    const rawInputAmount = totalUsdcNeeded / tokenPrice;
    const inputAmountFormatted = rawInputAmount.toFixed(token.decimals > 8 ? 6 : token.decimals);

    const quoteId = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 1000).toISOString();

    const quote: PaymentQuote = {
      quoteId,
      endpointUrl: params.endpointUrl,
      inputToken: token.symbol,
      inputChainId: token.chainId,
      inputAmount: inputAmountFormatted,
      inputAmountUSD: totalUsdcNeeded.toFixed(4),
      usdcRequired: requiredUsdcAmount,
      feeUsdc: feeUsdcNum.toFixed(6),
      feeBps,
      route: {
        dex: token.chainId === 1000 ? 'Liquidswap / Aptos DEX' : (token.swapPath === 'lightning' ? 'Lightning Node Float' : '1inch + 0x Aggregator'),
        priceImpact: '0.0005',
        path: [token.symbol, 'USDC']
      },
      expiresAt
    };

    this.quoteCache.set(quoteId, { quote, createdAt: Date.now() });
    return quote;
  }

  public getCachedQuote(quoteId: string): PaymentQuote | null {
    const item = this.quoteCache.get(quoteId);
    if (!item) return null;
    if (Date.now() - item.createdAt > 30000) {
      this.quoteCache.delete(quoteId);
      return null;
    }
    return item.quote;
  }
}
