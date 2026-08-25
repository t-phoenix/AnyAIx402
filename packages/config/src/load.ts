import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  type AnyxConfig,
  type Capability,
  type ConfigField,
  CONFIG_FIELDS,
  CONFIG_GROUPS,
  anyxConfigSchema,
} from "./schema.ts";

const ENV_MAP: Record<string, keyof AnyxConfig> = {
  PORT: "port",
  NODE_ENV: "nodeEnv",
  ANYX_STUB_PAYMENTS: "stubPayments",
  ANYX_PUBLIC_URL: "publicUrl",
  DATABASE_URL: "databaseUrl",
  REDIS_URL: "redisUrl",
  RPC_URL_BASE: "rpcUrlBase",
  RPC_URL_BASE_SEPOLIA: "rpcUrlBaseSepolia",
  RPC_URL_ETHEREUM: "rpcUrlEthereum",
  RPC_URL_SOLANA: "rpcUrlSolana",
  PRIVATE_KEY: "privateKey",
  ONEINCH_API_KEY: "oneInchApiKey",
  ZEROX_API_KEY: "zeroXApiKey",
  FACILITATOR_URL: "facilitatorUrl",
  FACILITATOR_FALLBACK_URL: "facilitatorFallbackUrl",
  CDP_API_KEY_NAME: "cdpApiKeyName",
  CDP_API_KEY_PRIVATE_KEY: "cdpApiKeyPrivateKey",
  CCTP_ATTESTER_URL: "cctpAttesterUrl",
  FEE_BPS: "feeBps",
  MIN_FEE_USDC: "minFeeUsdc",
  USDC_BASE: "usdcBase",
  ANYX_ROUTER: "anyxRouter",
  FEE_COLLECTOR: "feeCollector",
  API_SECRET: "apiSecret",
  STRIPE_SECRET_KEY: "stripeSecretKey",
  STRIPE_WEBHOOK_SECRET: "stripeWebhookSecret",
  STRIPE_PRO_PRICE_ID: "stripeProPriceId",
  COINGECKO_API_KEY: "coinGeckoApiKey",
  OPENAI_API_KEY: "openaiApiKey",
  OPENAI_MODEL: "openaiModel",
  ANTHROPIC_API_KEY: "anthropicApiKey",
  ANTHROPIC_MODEL: "anthropicModel",
  LND_TLS_CERT_PATH: "lndTlsCertPath",
  LND_MACAROON_PATH: "lndMacaroonPath",
  LND_GRPC_HOST: "lndGrpcHost",
  PAYMENT_WEBHOOK_URL: "paymentWebhookUrl",
  PAYMENT_WEBHOOK_SECRET: "paymentWebhookSecret",
};

function flattenYaml(input: Record<string, unknown>, prefix = ""): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenYaml(value as Record<string, unknown>, next));
    } else {
      out[next] = value;
    }
  }
  return out;
}

const YAML_TO_ENV: Record<string, string> = {
  "app.port": "PORT",
  "app.stubPayments": "ANYX_STUB_PAYMENTS",
  "app.publicUrl": "ANYX_PUBLIC_URL",
  "data.databaseUrl": "DATABASE_URL",
  "data.redisUrl": "REDIS_URL",
  "chain.baseRpc": "RPC_URL_BASE",
  "chain.ethereumRpc": "RPC_URL_ETHEREUM",
  "chain.solanaRpc": "RPC_URL_SOLANA",
  "wallet.privateKey": "PRIVATE_KEY",
  "dex.oneInchApiKey": "ONEINCH_API_KEY",
  "dex.zeroXApiKey": "ZEROX_API_KEY",
  "x402.facilitatorUrl": "FACILITATOR_URL",
  "x402.facilitatorFallbackUrl": "FACILITATOR_FALLBACK_URL",
  "circle.cctpAttesterUrl": "CCTP_ATTESTER_URL",
  "fees.feeBps": "FEE_BPS",
  "fees.minFeeUsdc": "MIN_FEE_USDC",
  "mas.openaiApiKey": "OPENAI_API_KEY",
  "mas.anthropicApiKey": "ANTHROPIC_API_KEY",
  "billing.stripeSecretKey": "STRIPE_SECRET_KEY",
  "lightning.macaroonPath": "LND_MACAROON_PATH",
  "webhooks.paymentUrl": "PAYMENT_WEBHOOK_URL",
};

export type MissingField = {
  env: string;
  label: string;
  hint: string;
  group: string;
  groupTitle: string;
  requiredFor: Capability[];
};

export type ConfigStatus = {
  config: AnyxConfig;
  capabilities: Record<Capability, boolean>;
  missing: MissingField[];
  present: { env: string; label: string; group: string }[];
};

function isSet(config: AnyxConfig, field: ConfigField): boolean {
  const value = config[field.path];
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return true;
  return value !== undefined && value !== null && String(value).length > 0;
}

export function envFromProcess(source: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [envKey, path] of Object.entries(ENV_MAP)) {
    const value = source[envKey];
    if (value !== undefined) raw[path] = value;
  }
  return raw;
}

export function loadYamlFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  const parsed = parseYaml(readFileSync(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object") return {};
  const flat = flattenYaml(parsed as Record<string, unknown>);
  const raw: Record<string, unknown> = {};
  for (const [yamlPath, envKey] of Object.entries(YAML_TO_ENV)) {
    if (flat[yamlPath] === undefined) continue;
    const configPath = ENV_MAP[envKey];
    if (configPath) raw[configPath] = flat[yamlPath];
  }
  return raw;
}

export function loadConfig(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  yamlPath?: string;
}): AnyxConfig {
  const cwd = options?.cwd ?? process.cwd();
  const yamlPath = options?.yamlPath ?? resolve(cwd, "config/user.config.yaml");
  const merged = {
    ...loadYamlFile(yamlPath),
    ...envFromProcess(options?.env ?? process.env),
  };
  return anyxConfigSchema.parse(merged);
}

export function evaluateCapabilities(config: AnyxConfig): Record<Capability, boolean> {
  const hasDex = Boolean(config.oneInchApiKey || config.zeroXApiKey);
  return {
    api: true,
    quote_stub: true,
    quote_live: hasDex,
    pay_stub: config.stubPayments,
    pay_live: Boolean(config.privateKey) && !config.stubPayments,
    persist: Boolean(config.databaseUrl),
    rate_limit: Boolean(config.redisUrl),
    mas_llm: Boolean(config.openaiApiKey || config.anthropicApiKey),
    lightning: Boolean(config.lndMacaroonPath && config.lndTlsCertPath),
    billing: Boolean(config.stripeSecretKey),
    cctp: Boolean(config.rpcUrlEthereum || config.rpcUrlSolana),
  };
}

export function getConfigStatus(config: AnyxConfig): ConfigStatus {
  const capabilities = evaluateCapabilities(config);
  const missing: MissingField[] = [];
  const present: ConfigStatus["present"] = [];

  for (const field of CONFIG_FIELDS) {
    const group = CONFIG_GROUPS[field.group];
    if (isSet(config, field) && field.path !== "port" && field.path !== "feeBps") {
      if (
        field.path === "stubPayments" ||
        field.path === "facilitatorUrl" ||
        field.path === "rpcUrlBase" ||
        field.path === "cctpAttesterUrl" ||
        field.path === "publicUrl"
      ) {
        // defaults count as configured
      }
      if (config[field.path]) {
        present.push({ env: field.env, label: field.label, group: field.group });
      }
    }
    const neededNow = field.requiredFor.some((cap) => {
      if (cap === "quote_live") return !capabilities.quote_live;
      if (cap === "pay_live") return !capabilities.pay_live && !config.stubPayments;
      if (cap === "mas_llm") return false;
      if (cap === "lightning" || cap === "billing" || cap === "cctp" || cap === "persist") {
        return false;
      }
      return false;
    });
    if (neededNow && !isSet(config, field)) {
      missing.push({
        env: field.env,
        label: field.label,
        hint: field.hint,
        group: field.group,
        groupTitle: group.title,
        requiredFor: field.requiredFor,
      });
    }
  }

  if (!capabilities.quote_live) {
    missing.push({
      env: "ONEINCH_API_KEY or ZEROX_API_KEY",
      label: "DEX aggregator key",
      hint: "Add a 1inch or 0x API key to get live swap quotes. Until then, AnyX uses demo quotes (clearly marked).",
      group: "dex",
      groupTitle: CONFIG_GROUPS.dex.title,
      requiredFor: ["quote_live"],
    });
  }

  if (!config.privateKey) {
    missing.push({
      env: "PRIVATE_KEY",
      label: "Hot signer private key",
      hint: CONFIG_FIELDS.find((f) => f.env === "PRIVATE_KEY")?.hint ?? "",
      group: "signer",
      groupTitle: CONFIG_GROUPS.signer.title,
      requiredFor: ["pay_live"],
    });
  }

  return { config, capabilities, missing, present };
}

export function formatMissingReport(status: ConfigStatus): string {
  const lines: string[] = [];
  lines.push("AnyX configuration check");
  lines.push("========================");
  lines.push("");
  lines.push("What already works:");
  lines.push(
    `  • API / health: yes`,
  );
  lines.push(
    `  • Quotes: ${status.capabilities.quote_live ? "live DEX quotes" : "demo (stub) quotes — add a 1inch or 0x key for live rates"}`,
  );
  lines.push(
    `  • Payments: ${
      status.capabilities.pay_live
        ? "live EIP-3009 settlement"
        : status.config.stubPayments
          ? "simulated receipts (ANYX_STUB_PAYMENTS=true)"
          : "blocked — need PRIVATE_KEY and ANYX_STUB_PAYMENTS=false"
    }`,
  );
  lines.push(
    `  • Agent LLM assist: ${status.capabilities.mas_llm ? "enabled" : "off (optional)"}`,
  );
  lines.push("");

  const byGroup = new Map<string, MissingField[]>();
  for (const item of status.missing) {
    const list = byGroup.get(item.groupTitle) ?? [];
    list.push(item);
    byGroup.set(item.groupTitle, list);
  }

  if (status.missing.length === 0) {
    lines.push("Nothing required is missing. You can run live quotes and payments.");
    return lines.join("\n");
  }

  lines.push("Still to fill in (only if you want that feature):");
  for (const [title, items] of byGroup) {
    lines.push("");
    lines.push(`${title}`);
    for (const item of items) {
      lines.push(`  • ${item.label}  (${item.env})`);
      lines.push(`    ${item.hint}`);
    }
  }
  lines.push("");
  lines.push("How to fill these in:");
  lines.push("  1. Copy .env.example to .env.local and paste values next to each name.");
  lines.push("  2. Or copy config/user.config.example.yaml to config/user.config.yaml.");
  lines.push("  3. Or open http://localhost:3000/setup after `npm run dev:api`.");
  lines.push("");
  lines.push("Secrets stay on your machine. Do not commit .env.local or user.config.yaml.");
  return lines.join("\n");
}

export function publicStatusPayload(status: ConfigStatus) {
  const groups = Object.entries(CONFIG_GROUPS).map(([id, meta]) => ({
    id,
    title: meta.title,
    blurb: meta.blurb,
    fields: CONFIG_FIELDS.filter((f) => f.group === id).map((f) => ({
      env: f.env,
      label: f.label,
      hint: f.hint,
      present: isPresentForUi(status.config, f),
      requiredFor: f.requiredFor,
    })),
  }));
  return {
    capabilities: status.capabilities,
    groups,
    stubPayments: status.config.stubPayments,
  };
}

function isPresentForUi(config: AnyxConfig, field: ConfigField): boolean {
  if (field.env === "ONEINCH_API_KEY") return Boolean(config.oneInchApiKey);
  if (field.env === "ZEROX_API_KEY") return Boolean(config.zeroXApiKey);
  if (field.env === "PRIVATE_KEY") return Boolean(config.privateKey);
  if (field.env === "DATABASE_URL") return Boolean(config.databaseUrl);
  if (field.env === "REDIS_URL") return Boolean(config.redisUrl);
  if (field.env === "OPENAI_API_KEY") return Boolean(config.openaiApiKey);
  if (field.env === "ANTHROPIC_API_KEY") return Boolean(config.anthropicApiKey);
  if (field.env === "STRIPE_SECRET_KEY") return Boolean(config.stripeSecretKey);
  if (field.env === "API_SECRET") return Boolean(config.apiSecret);
  if (field.env === "LND_MACAROON_PATH") return Boolean(config.lndMacaroonPath);
  if (field.env === "PAYMENT_WEBHOOK_URL") return Boolean(config.paymentWebhookUrl);
  if (field.env === "RPC_URL_ETHEREUM") return Boolean(config.rpcUrlEthereum);
  if (field.env === "RPC_URL_SOLANA") return Boolean(config.rpcUrlSolana);
  if (field.env === "FACILITATOR_FALLBACK_URL") return Boolean(config.facilitatorFallbackUrl);
  return isSet(config, field);
}
