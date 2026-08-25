import { http, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UPAError } from '../errors';
import { UPA } from '../upa';

const TEST_WALLET = createWalletClient({
  account: privateKeyToAccount(
    '0x0000000000000000000000000000000000000000000000000000000000000001',
  ),
  chain: base,
  transport: http(),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('UPA', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('throws INVALID_INPUT when preferredToken is missing', () => {
    expect(() => new UPA({ preferredToken: '', preferredChainId: 8453 })).toThrow(UPAError);
  });

  describe('quote()', () => {
    it('POSTs /v1/quote with preferredToken/preferredChainId and returns the parsed quote', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          quoteId: 'q-1',
          inputToken: 'ETH',
          inputAmount: '0.0004',
          usdcRequired: '1.00',
          fee: '0.002',
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
          route: { dex: '1inch' },
          payTo: '0xRecipient',
        }),
      );
      global.fetch = fetchMock;

      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453 });
      const quote = await upa.quote('https://api.example.com/data');

      expect(quote.quoteId).toBe('q-1');
      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(url.toString()).toBe('https://api.anyx.xyz/v1/quote');
      expect(JSON.parse(init.body as string)).toMatchObject({
        endpointUrl: 'https://api.example.com/data',
        inputToken: 'ETH',
        inputChainId: 8453,
      });
    });

    it('throws FEE_TOO_HIGH when the quoted fee exceeds maxFeePercent', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          quoteId: 'q-2',
          inputToken: 'ETH',
          inputAmount: '0.01',
          usdcRequired: '1.00',
          fee: '0.50', // 50% fee — way above any reasonable maxFeePercent
          expiresAt: new Date().toISOString(),
          route: {},
          payTo: '0xRecipient',
        }),
      );

      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453, maxFeePercent: 0.01 });
      await expect(upa.quote('https://api.example.com/data')).rejects.toMatchObject({
        code: 'FEE_TOO_HIGH',
      });
    });

    it('surfaces AnyX API errors (e.g. ENDPOINT_NOT_X402-style) as a UPAError with the server code', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { code: 'INVALID_INPUT', message: 'not a 402 endpoint' } }, 400),
        );

      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453 });
      await expect(upa.quote('https://api.example.com/data')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });
  });

  describe('pay()', () => {
    it('throws WALLET_REQUIRED when no wallet is configured', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        jsonResponse({
          quoteId: 'q-3',
          inputToken: 'ETH',
          inputAmount: '0.0004',
          usdcRequired: '1.00',
          fee: '0.002',
          expiresAt: new Date(Date.now() + 30_000).toISOString(),
          route: {},
          payTo: '0xRecipient',
        }),
      );

      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453 });
      await expect(upa.pay('https://api.example.com/data')).rejects.toMatchObject({
        code: 'WALLET_REQUIRED',
      });
    });

    it('pays with an existing quoteId, enriches with the itemized receipt, and emits "payment"', async () => {
      const fetchMock = vi.fn().mockImplementation((input: URL) => {
        const url = input.toString();
        if (url.endsWith('/v1/pay')) {
          return Promise.resolve(
            jsonResponse({
              receiptId: 'r-1',
              txHash: '0xtx',
              apiResponse: { price: 65432.1 },
              status: 'settled',
            }),
          );
        }
        if (url.includes('/v1/receipt/')) {
          return Promise.resolve(
            jsonResponse({
              receiptId: 'r-1',
              timestamp: new Date().toISOString(),
              endpoint: 'https://api.example.com/data',
              inputToken: 'ETH',
              inputTokenAddress: null,
              inputAmount: '0.0004',
              inputAmountUSD: '1.002',
              apiCostUSDC: '1.00',
              adapterFeeUSDC: '0.002',
              swapSlippage: '0.0008',
              txHash: '0xtx',
              blockNumber: 123,
              facilitator: 'https://api.cdp.coinbase.com/platform/v2/x402',
              xPaymentResponse: 'base64receipt',
              status: 'settled',
            }),
          );
        }
        throw new Error(`unexpected URL in test: ${url}`);
      });
      global.fetch = fetchMock;

      const onPayment = vi.fn();
      const upa = new UPA({
        preferredToken: 'ETH',
        preferredChainId: 8453,
        wallet: TEST_WALLET,
        onPayment,
      });

      const receipt = await upa.pay('https://api.example.com/data', { quoteId: 'q-existing' });

      expect(receipt.receiptId).toBe('r-1');
      expect(receipt.txHash).toBe('0xtx');
      expect(receipt.apiResponse).toEqual({ price: 65432.1 });
      expect(receipt.apiCostUSDC).toBe('1.00');
      expect(onPayment).toHaveBeenCalledOnce();

      // Reusing an existing quoteId must skip a redundant /v1/quote call.
      const calledPaths = fetchMock.mock.calls.map(([u]) => (u as URL).pathname);
      expect(calledPaths).not.toContain('/v1/quote');
    });
  });

  describe('fetch()', () => {
    it('returns the initial response unchanged when it is not a 402', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453 });

      const res = await upa.fetch('https://api.example.com/free');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('ok');
    });

    it('on a 402, quotes, pays, and returns a synthetic 200 Response with the API body', async () => {
      let call = 0;
      global.fetch = vi.fn().mockImplementation((input: string | URL) => {
        const url = input.toString();
        call += 1;
        if (call === 1) {
          // The direct request to the target URL — simulate a 402 challenge.
          return Promise.resolve(new Response('Payment Required', { status: 402 }));
        }
        if (url.includes('/v1/quote')) {
          return Promise.resolve(
            jsonResponse({
              quoteId: 'q-4',
              inputToken: 'ETH',
              inputAmount: '0.0004',
              usdcRequired: '1.00',
              fee: '0.002',
              expiresAt: new Date(Date.now() + 30_000).toISOString(),
              route: {},
              payTo: '0xRecipient',
            }),
          );
        }
        if (url.includes('/v1/pay')) {
          return Promise.resolve(
            jsonResponse({
              receiptId: 'r-2',
              txHash: '0xtx2',
              apiResponse: { price: 12345 },
              status: 'settled',
            }),
          );
        }
        if (url.includes('/v1/receipt/')) {
          // Simulate the itemized-receipt lookup failing transiently — pay() must still succeed.
          return Promise.resolve(new Response('unavailable', { status: 503 }));
        }
        throw new Error(`unexpected URL in test: ${url}`);
      });

      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453, wallet: TEST_WALLET });
      const res = await upa.fetch('https://api.example.com/data');

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ price: 12345 });
    });
  });

  describe('getSupportedTokens()', () => {
    it('GETs /v1/tokens and returns the tokens array', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ tokens: [{ symbol: 'ETH' }], updatedAt: new Date().toISOString() }),
        );
      const upa = new UPA({ preferredToken: 'ETH', preferredChainId: 8453 });
      const tokens = await upa.getSupportedTokens();
      expect(tokens).toEqual([{ symbol: 'ETH' }]);
    });
  });
});
