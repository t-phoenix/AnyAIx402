import type { ApiConfig } from '../config.js';

/**
 * Served at /openapi.json. Kept as a literal rather than generated so the
 * published contract cannot drift silently when a handler is refactored.
 */
export function openApiDocument(config: ApiConfig): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'AnyX API',
      version: config.version,
      description:
        'Universal x402 payment adapter. Quote and settle x402 payments using any supported token; the provider always receives USDC on Base.',
      license: { name: 'Apache-2.0', identifier: 'Apache-2.0' },
    },
    servers: [
      { url: 'https://api.anyx.xyz', description: 'production' },
      { url: `http://localhost:${config.port}`, description: 'local' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'QUOTE_NOT_FOUND',
                    'QUOTE_EXPIRED',
                    'SWAP_FAILED',
                    'SETTLEMENT_FAILED',
                    'INVALID_INPUT',
                    'RATE_LIMITED',
                    'INSUFFICIENT_BALANCE',
                  ],
                },
                message: { type: 'string' },
                details: {},
              },
            },
          },
        },
        Token: {
          type: 'object',
          properties: {
            symbol: { type: 'string', examples: ['ETH'] },
            name: { type: 'string' },
            address: { type: ['string', 'null'] },
            chainId: { type: 'integer', examples: [8453] },
            decimals: { type: 'integer' },
            isNative: { type: 'boolean' },
            priceUsd: { type: ['string', 'null'] },
          },
        },
        Quote: {
          type: 'object',
          properties: {
            quoteId: { type: 'string', format: 'uuid' },
            endpointUrl: { type: ['string', 'null'] },
            inputToken: { $ref: '#/components/schemas/Token' },
            inputAmount: { type: 'string', description: 'Atomic units of the input token' },
            usdcRequired: { type: 'string', description: 'Atomic USDC the server requires' },
            usdcGross: { type: 'string', description: 'usdcRequired plus the AnyX spread' },
            fee: {
              type: 'object',
              properties: { bps: { type: 'integer' }, usdc: { type: 'string' } },
            },
            minAmountOut: {
              type: 'string',
              description: 'Always equals usdcRequired. A swap yielding less must fail.',
            },
            slippageBps: { type: 'integer' },
            expiresAt: { type: 'string', format: 'date-time' },
          },
        },
        PaymentReceipt: {
          type: 'object',
          properties: {
            receiptId: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            endpoint: { type: 'string' },
            inputToken: { type: 'string' },
            inputAmount: { type: 'string' },
            inputAmountUSD: { type: ['string', 'null'] },
            apiCostUSDC: { type: 'string' },
            adapterFeeUSDC: { type: 'string' },
            swapSlippage: { type: ['string', 'null'] },
            txHash: { type: ['string', 'null'] },
            blockNumber: { type: ['integer', 'null'] },
            facilitator: { type: ['string', 'null'] },
            status: { type: 'string', enum: ['pending', 'settled', 'failed'] },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Invalid request',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        NotFound: {
          description: 'Not found',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
        RateLimited: {
          description: 'Rate limit exceeded',
          headers: { 'Retry-After': { schema: { type: 'integer' } } },
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
        },
      },
    },
    security: [{ ApiKeyAuth: [] }, {}],
    paths: {
      '/health': {
        get: {
          summary: 'Health and capability report',
          description:
            'Always 200 while the process is serving. `degraded` lists capabilities that are off, each with a reason.',
          security: [{}],
          responses: { '200': { description: 'Service status' } },
        },
      },
      '/v1/tokens': {
        get: {
          summary: 'List supported input tokens',
          security: [{}],
          responses: {
            '200': {
              description: 'Supported tokens',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tokens: { type: 'array', items: { $ref: '#/components/schemas/Token' } },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/quote': {
        post: {
          summary: 'Price a payment',
          description:
            'Fetches the 402 challenge from the endpoint, reads the required USDC, and returns the best route with the AnyX spread applied. Valid for 30 seconds.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['endpointUrl', 'inputToken', 'inputChainId'],
                  properties: {
                    endpointUrl: { type: 'string', format: 'uri' },
                    inputToken: { type: 'string', examples: ['ETH'] },
                    inputChainId: { type: 'integer', examples: [8453] },
                    slippageBps: { type: 'integer', minimum: 0, maximum: 1000 },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'A quote',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Quote' } } },
            },
            '400': { $ref: '#/components/responses/BadRequest' },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/v1/pay': {
        post: {
          summary: 'Settle a quoted payment',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['quoteId'],
                  properties: {
                    quoteId: { type: 'string' },
                    walletAddress: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
                    endpointUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Settlement result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      receipt: { $ref: '#/components/schemas/PaymentReceipt' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
            '410': {
              description: 'The quote expired',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            '429': { $ref: '#/components/responses/RateLimited' },
          },
        },
      },
      '/v1/receipt/{id}': {
        get: {
          summary: 'Retrieve a payment receipt',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'The receipt',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/PaymentReceipt' } },
              },
            },
            '404': { $ref: '#/components/responses/NotFound' },
          },
        },
      },
      '/v1/lightning/invoice': {
        post: {
          summary: 'Generate a Lightning invoice',
          description: 'Phase 4. Returns 501 until the Lightning gateway is implemented.',
          responses: {
            '501': {
              description: 'Not implemented',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
          },
        },
      },
    },
  };
}
