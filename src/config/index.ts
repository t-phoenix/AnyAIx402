import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ConfigSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_SECRET: z.string().default('dev_secret_key_change_in_prod'),

  // DEX Aggregator API Keys
  ONEINCH_API_KEY: z.string().optional().default(''),
  ZEROX_API_KEY: z.string().optional().default(''),

  // EVM RPC URLs & Keys
  RPC_URL_BASE: z.string().default('https://mainnet.base.org'),
  RPC_URL_ETHEREUM: z.string().default('https://eth.llamarpc.com'),
  RPC_URL_BASE_SEPOLIA: z.string().default('https://sepolia.base.org'),
  PRIVATE_KEY: z.string().default('0x0000000000000000000000000000000000000000000000000000000000000001'),

  // Aptos / Move Configuration
  APTOS_NODE_URL: z.string().default('https://fullnode.mainnet.aptoslabs.com/v1'),
  APTOS_FAUCET_URL: z.string().default('https://faucet.devnet.aptoslabs.com'),
  APTOS_NETWORK: z.enum(['mainnet', 'testnet', 'devnet', 'localnet']).default('mainnet'),
  APTOS_MODULE_ADDRESS: z.string().default('0x1'),
  APTOS_PRIVATE_KEY: z.string().optional().default(''),

  // Solana & Bitcoin Lightning
  RPC_URL_SOLANA: z.string().default('https://api.mainnet-beta.solana.com'),
  LND_REST_URL: z.string().optional().default(''),
  LND_MACAROON_HEX: z.string().optional().default(''),

  // Facilitator & Fee
  FACILITATOR_URL: z.string().default('https://api.cdp.coinbase.com/platform/v2/x402'),
  FACILITATOR_FALLBACK_URL: z.string().default('https://x402.halowerk.com/facilitator'),
  FEE_BPS: z.coerce.number().default(20), // 0.20% default spread
  MIN_FEE_USDC: z.string().default('0.001'),

  // Circle CCTP
  CCTP_ATTESTER_URL: z.string().default('https://iris-api.circle.com'),

  // LLM / AI API Keys for Multi-Agent reasoning
  OPENAI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),

  // Stripe Billing
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_PRO_PRICE_ID: z.string().optional().default('price_pro_monthly')
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let _config: AppConfig | null = null;

export function loadConfig(envOverride?: Record<string, string>): AppConfig {
  const merged = {
    ...process.env,
    ...(envOverride || {})
  };
  const parsed = ConfigSchema.safeParse(merged);
  if (!parsed.success) {
    console.error('❌ Invalid configuration:', parsed.error.format());
    throw new Error('Configuration validation failed');
  }
  _config = parsed.data;
  return _config;
}

export function getConfig(): AppConfig {
  if (!_config) {
    return loadConfig();
  }
  return _config;
}

export function getManualConfigRequirements(): Array<{
  category: string;
  keys: Array<{ key: string; description: string; requiredFor: string; isSet: boolean }>;
}> {
  const cfg = getConfig();
  return [
    {
      category: 'DEX Liquidity & Swaps',
      keys: [
        {
          key: 'ONEINCH_API_KEY',
          description: '1inch Fusion+ & Aggregator API Key',
          requiredFor: 'Production high-volume DEX swaps on EVM',
          isSet: Boolean(cfg.ONEINCH_API_KEY && cfg.ONEINCH_API_KEY.length > 0)
        },
        {
          key: 'ZEROX_API_KEY',
          description: '0x Swap API key',
          requiredFor: '0x DEX routing & RFQ liquidity fallback',
          isSet: Boolean(cfg.ZEROX_API_KEY && cfg.ZEROX_API_KEY.length > 0)
        }
      ]
    },
    {
      category: 'Blockchains & Signing',
      keys: [
        {
          key: 'PRIVATE_KEY',
          description: 'EVM Hot Signer / Relayer Private Key',
          requiredFor: 'EIP-3009 authorizations & router contract execution on Base',
          isSet: Boolean(cfg.PRIVATE_KEY && cfg.PRIVATE_KEY !== '0x0000000000000000000000000000000000000000000000000000000000000001')
        },
        {
          key: 'APTOS_PRIVATE_KEY',
          description: 'Aptos Account Private Key',
          requiredFor: 'Publishing and executing Aptos Move x402 payment contracts',
          isSet: Boolean(cfg.APTOS_PRIVATE_KEY && cfg.APTOS_PRIVATE_KEY.length > 0)
        }
      ]
    },
    {
      category: 'Bitcoin Lightning Gateway',
      keys: [
        {
          key: 'LND_REST_URL',
          description: 'Lightning LND REST / gRPC endpoint',
          requiredFor: 'Generating and watching BOLT-11 Lightning invoices for BTC payers',
          isSet: Boolean(cfg.LND_REST_URL && cfg.LND_REST_URL.length > 0)
        },
        {
          key: 'LND_MACAROON_HEX',
          description: 'LND Invoice / Read Macaroon Hex',
          requiredFor: 'Authenticating with Lightning Node',
          isSet: Boolean(cfg.LND_MACAROON_HEX && cfg.LND_MACAROON_HEX.length > 0)
        }
      ]
    },
    {
      category: 'AI & LLM Services',
      keys: [
        {
          key: 'OPENAI_API_KEY',
          description: 'OpenAI API Key for Agent reasoning',
          requiredFor: 'Autonomous code generation, natural language bug remediation',
          isSet: Boolean(cfg.OPENAI_API_KEY && cfg.OPENAI_API_KEY.length > 0)
        },
        {
          key: 'ANTHROPIC_API_KEY',
          description: 'Anthropic Claude API Key',
          requiredFor: 'Claude-based agentic workflows',
          isSet: Boolean(cfg.ANTHROPIC_API_KEY && cfg.ANTHROPIC_API_KEY.length > 0)
        }
      ]
    },
    {
      category: 'Billing & Monetization',
      keys: [
        {
          key: 'STRIPE_SECRET_KEY',
          description: 'Stripe Secret Key for Pro subscriptions ($49/mo)',
          requiredFor: 'Automated subscription checkouts and billing webhooks',
          isSet: Boolean(cfg.STRIPE_SECRET_KEY && cfg.STRIPE_SECRET_KEY.length > 0)
        }
      ]
    }
  ];
}
