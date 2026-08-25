import { buildFeatureReport, toFeatureFlags } from "./features.ts";
import { maskValue } from "./mask.ts";
import { CONFIG_REGISTRY, REGISTRY_BY_KEY, REQUIREMENT_RULES } from "./registry.ts";
import { collectLayers } from "./sources.ts";
import type {
  AnyxConfig,
  ConfigEnvironment,
  ConfigValue,
  LoadConfigOptions,
  LoadConfigResult,
  ResolvedValue,
  ResolvedValues,
  ValidationIssue,
  ValidationResult,
} from "./types.ts";
import { CONFIG_ENVIRONMENTS } from "./types.ts";
import { coerce, isPlaceholder, typeErrorFor } from "./validators.ts";

export function resolveEnvironment(
  candidate: string | undefined,
  fallback: ConfigEnvironment = "dev",
): ConfigEnvironment {
  if (candidate === undefined) return fallback;
  const normalised = candidate.trim().toLowerCase();
  if (normalised === "development") return "dev";
  if (normalised === "prod") return "production";
  return CONFIG_ENVIRONMENTS.includes(normalised as ConfigEnvironment)
    ? (normalised as ConfigEnvironment)
    : fallback;
}

export function resolveValues(options: LoadConfigOptions = {}): {
  readonly env: ConfigEnvironment;
  readonly values: ResolvedValues;
  readonly loadedFiles: readonly string[];
} {
  const processEnv = options.processEnv ?? (process.env as Readonly<Record<string, string | undefined>>);
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? resolveEnvironment(processEnv.ANYX_ENV);

  const layers = collectLayers({
    cwd,
    env,
    processEnv,
    skipFiles: options.skipFiles ?? false,
  });

  const values: Record<string, ResolvedValue> = {};

  for (const definition of CONFIG_REGISTRY) {
    let raw: string | undefined;
    let source: ResolvedValue["source"] = "unset";

    for (const layer of layers) {
      const candidate = layer.values[definition.key];
      if (candidate !== undefined && candidate.trim() !== "") {
        raw = candidate.trim();
        source = layer.source;
        break;
      }
    }

    if (raw !== undefined && isPlaceholder(raw)) {
      raw = undefined;
      source = "unset";
    }

    let value: ConfigValue | undefined;
    if (raw !== undefined && typeErrorFor(definition, raw) === null) {
      value = coerce(definition, raw);
    } else if (raw !== undefined) {
      value = raw;
    } else if (definition.default !== undefined) {
      value = definition.default;
      source = "default";
    }

    values[definition.key] = {
      key: definition.key,
      group: definition.group,
      raw,
      value,
      source,
      secret: definition.secret,
      display: maskValue(definition, raw ?? (value === undefined ? undefined : String(value))),
    };
  }

  const loadedFiles = layers
    .map((layer) => layer.file)
    .filter((file): file is string => file !== undefined);

  return { env, values: Object.freeze(values), loadedFiles };
}

function issue(
  key: string,
  group: ValidationIssue["group"],
  message: string,
  howToObtain: string,
  blocksFeatures: ValidationIssue["blocksFeatures"],
  docsUrl?: string,
): ValidationIssue {
  return { key, group, message, howToObtain, blocksFeatures, docsUrl };
}

export function validate(values: ResolvedValues, env: ConfigEnvironment): ValidationResult {
  const missing: ValidationIssue[] = [];
  const invalid: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  for (const definition of CONFIG_REGISTRY) {
    const resolved = values[definition.key];
    const raw = resolved?.raw;
    const required = definition.required[env];

    if (raw === undefined) {
      const usingDefault = resolved?.source === "default";
      if (required && !usingDefault) {
        missing.push(
          issue(
            definition.key,
            definition.group,
            `${definition.key} is required in the ${env} environment and is not set. ${definition.description}`,
            definition.howToObtain,
            definition.blocksFeatures,
            definition.docsUrl,
          ),
        );
      } else if (!usingDefault && definition.blocksFeatures.length > 0) {
        warnings.push(
          issue(
            definition.key,
            definition.group,
            `${definition.key} is not set, so these capabilities stay disabled: ${definition.blocksFeatures.join(", ")}.`,
            definition.howToObtain,
            definition.blocksFeatures,
            definition.docsUrl,
          ),
        );
      }
      continue;
    }

    const typeError = typeErrorFor(definition, raw);
    if (typeError !== null) {
      invalid.push(
        issue(
          definition.key,
          definition.group,
          `${definition.key} is invalid: ${typeError}.`,
          definition.howToObtain,
          definition.blocksFeatures,
          definition.docsUrl,
        ),
      );
      continue;
    }

    const customError = definition.validate?.(raw) ?? null;
    if (customError !== null) {
      invalid.push(
        issue(
          definition.key,
          definition.group,
          `${definition.key} is invalid: ${customError}.`,
          definition.howToObtain,
          definition.blocksFeatures,
          definition.docsUrl,
        ),
      );
    }
  }

  for (const rule of REQUIREMENT_RULES) {
    const satisfied = rule.anyOf.some((key) => values[key]?.raw !== undefined);
    if (satisfied) continue;

    const target = rule.requiredIn.includes(env) ? missing : warnings;
    target.push(
      issue(
        rule.anyOf.join(" or "),
        "multiple",
        `${rule.title}. Set one of: ${rule.anyOf.join(", ")}.`,
        rule.howToObtain,
        rule.blocksFeatures,
      ),
    );
  }

  if (env === "production" && values.PRIVATE_KEY?.raw !== undefined) {
    warnings.push(
      issue(
        "PRIVATE_KEY",
        "signer",
        "PRIVATE_KEY is set in a production environment. A local hot key that can authorize USDC transfers is the highest-severity item in the threat model.",
        "Move signing to Turnkey or Lit Protocol, set SIGNER_MODE accordingly, and remove PRIVATE_KEY from the production environment.",
        ["mpcSigner"],
      ),
    );
  }

  const feeBps = values.FEE_BPS?.value;
  const maxFeeBps = values.MAX_FEE_BPS?.value;
  if (typeof feeBps === "number" && typeof maxFeeBps === "number" && feeBps > maxFeeBps) {
    invalid.push(
      issue(
        "FEE_BPS",
        "fees",
        `FEE_BPS (${feeBps}) exceeds MAX_FEE_BPS (${maxFeeBps}). The router contract would reject this spread.`,
        "Lower FEE_BPS or raise MAX_FEE_BPS. The router caps the spread at 100 bps (1%).",
        [],
      ),
    );
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    env,
    missing,
    invalid,
    warnings,
  };
}

function str(values: ResolvedValues, key: string): string | undefined {
  const value = values[key]?.value;
  return typeof value === "string" && value !== "" ? value : undefined;
}

function strOrDefault(values: ResolvedValues, key: string): string {
  const value = str(values, key);
  if (value !== undefined) return value;
  const fallback = REGISTRY_BY_KEY[key]?.default;
  return typeof fallback === "string" ? fallback : "";
}

function num(values: ResolvedValues, key: string): number {
  const value = values[key]?.value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const fallback = REGISTRY_BY_KEY[key]?.default;
  return typeof fallback === "number" ? fallback : 0;
}

function bool(values: ResolvedValues, key: string): boolean {
  const value = values[key]?.value;
  if (typeof value === "boolean") return value;
  const fallback = REGISTRY_BY_KEY[key]?.default;
  return fallback === true;
}

function list(values: ResolvedValues, key: string): readonly string[] {
  return strOrDefault(values, key)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

export function buildConfig(values: ResolvedValues, env: ConfigEnvironment): AnyxConfig {
  return {
    env,
    runtime: {
      logLevel: strOrDefault(values, "LOG_LEVEL"),
    },
    network: {
      rpcUrlBase: strOrDefault(values, "RPC_URL_BASE"),
      rpcUrlEthereum: strOrDefault(values, "RPC_URL_ETHEREUM"),
      rpcUrlBaseSepolia: strOrDefault(values, "RPC_URL_BASE_SEPOLIA"),
      rpcUrlSolana: strOrDefault(values, "RPC_URL_SOLANA"),
      defaultChainId: num(values, "CHAIN_ID_DEFAULT"),
    },
    dex: {
      oneInchApiKey: str(values, "ONEINCH_API_KEY"),
      zeroExApiKey: str(values, "ZEROX_API_KEY"),
      jupiterApiUrl: strOrDefault(values, "JUPITER_API_URL"),
      coingeckoApiKey: str(values, "COINGECKO_API_KEY"),
      defaultSlippageBps: num(values, "DEFAULT_SLIPPAGE_BPS"),
      priority: list(values, "DEX_PRIORITY"),
      quoteTimeoutMs: num(values, "QUOTE_TIMEOUT_MS"),
    },
    x402: {
      facilitatorUrl: strOrDefault(values, "FACILITATOR_URL"),
      facilitatorFallbackUrl: str(values, "FACILITATOR_FALLBACK_URL"),
      facilitatorTimeoutMs: num(values, "FACILITATOR_TIMEOUT_MS"),
      maxTimeoutSeconds: num(values, "X402_MAX_TIMEOUT_SECONDS"),
      cdpApiKeyId: str(values, "CDP_API_KEY_ID"),
      cdpApiKeySecret: str(values, "CDP_API_KEY_SECRET"),
    },
    signer: {
      mode: strOrDefault(values, "SIGNER_MODE"),
      privateKey: str(values, "PRIVATE_KEY"),
      maxUsdcPerSession: num(values, "SIGNER_MAX_USDC_PER_SESSION"),
      turnkeyApiPublicKey: str(values, "TURNKEY_API_PUBLIC_KEY"),
      turnkeyApiPrivateKey: str(values, "TURNKEY_API_PRIVATE_KEY"),
      turnkeyOrganizationId: str(values, "TURNKEY_ORGANIZATION_ID"),
      turnkeyPrivateKeyId: str(values, "TURNKEY_PRIVATE_KEY_ID"),
      litApiKey: str(values, "LIT_PROTOCOL_API_KEY"),
      litPkpPublicKey: str(values, "LIT_PKP_PUBLIC_KEY"),
      litNetwork: strOrDefault(values, "LIT_NETWORK"),
    },
    fees: {
      feeBps: num(values, "FEE_BPS"),
      minFeeUsdc: num(values, "MIN_FEE_USDC"),
      feeBpsStable: num(values, "FEE_BPS_STABLE"),
      feeBpsEth: num(values, "FEE_BPS_ETH"),
      feeBpsBtc: num(values, "FEE_BPS_BTC"),
      feeBpsCrosschain: num(values, "FEE_BPS_CROSSCHAIN"),
      maxFeeBps: num(values, "MAX_FEE_BPS"),
    },
    storage: {
      databaseUrl: str(values, "DATABASE_URL"),
      databasePoolMax: num(values, "DATABASE_POOL_MAX"),
      redisUrl: str(values, "REDIS_URL"),
      quoteCacheTtlSeconds: num(values, "QUOTE_CACHE_TTL_SECONDS"),
    },
    api: {
      port: num(values, "PORT"),
      baseUrl: strOrDefault(values, "API_BASE_URL"),
      secret: str(values, "API_SECRET"),
      anyxApiKey: str(values, "ANYX_API_KEY"),
      corsAllowedOrigins: strOrDefault(values, "CORS_ALLOWED_ORIGINS"),
      rateLimitFreeRpm: num(values, "RATE_LIMIT_FREE_RPM"),
      rateLimitProRpm: num(values, "RATE_LIMIT_PRO_RPM"),
    },
    contracts: {
      usdcBase: strOrDefault(values, "USDC_BASE"),
      permit2: strOrDefault(values, "PERMIT2_ADDRESS"),
      anyxRouter: str(values, "ANYX_ROUTER"),
      feeCollector: str(values, "FEE_COLLECTOR"),
      reservePool: str(values, "RESERVE_POOL"),
      basescanApiKey: str(values, "BASESCAN_API_KEY"),
    },
    bridge: {
      cctpAttesterUrl: strOrDefault(values, "CCTP_ATTESTER_URL"),
      stargateRouter: str(values, "STARGATE_ROUTER_ADDRESS"),
      floatPoolTargetUsdc: num(values, "FLOAT_POOL_TARGET_USDC"),
      floatFundingWallet: str(values, "FLOAT_FUNDING_WALLET"),
      pollIntervalMs: num(values, "BRIDGE_POLL_INTERVAL_MS"),
      maxWaitSeconds: num(values, "BRIDGE_MAX_WAIT_SECONDS"),
    },
    lightning: {
      lndGrpcHost: str(values, "LND_GRPC_HOST"),
      lndTlsCertPath: str(values, "LND_TLS_CERT_PATH"),
      lndMacaroonPath: str(values, "LND_MACAROON_PATH"),
      invoiceExpirySeconds: num(values, "LIGHTNING_INVOICE_EXPIRY_SECONDS"),
      btcRateBufferBps: num(values, "BTC_RATE_BUFFER_BPS"),
    },
    billing: {
      stripeSecretKey: str(values, "STRIPE_SECRET_KEY"),
      stripeProPriceId: str(values, "STRIPE_PRO_PRICE_ID"),
      stripeWebhookSecret: str(values, "STRIPE_WEBHOOK_SECRET"),
      stripePortalReturnUrl: str(values, "STRIPE_PORTAL_RETURN_URL"),
    },
    deploy: {
      flyApiToken: str(values, "FLY_API_TOKEN"),
      flyAppApi: strOrDefault(values, "FLY_APP_API"),
      flyAppLightning: strOrDefault(values, "FLY_APP_LIGHTNING"),
      healthcheckUrl: strOrDefault(values, "HEALTHCHECK_URL"),
      npmToken: str(values, "NPM_TOKEN"),
    },
    orchestrator: {
      agentCommand: strOrDefault(values, "ORCHESTRATOR_AGENT_CMD"),
      agentEndpoint: str(values, "ORCHESTRATOR_AGENT_ENDPOINT"),
      maxFixAttempts: num(values, "ORCHESTRATOR_MAX_FIX_ATTEMPTS"),
      concurrency: num(values, "ORCHESTRATOR_CONCURRENCY"),
      autoApproveProduction: bool(values, "ORCHESTRATOR_AUTO_APPROVE_PRODUCTION"),
      stateDir: strOrDefault(values, "ORCHESTRATOR_STATE_DIR"),
    },
  };
}

/**
 * Loads configuration from every source, in precedence order, and reports what
 * is missing or invalid instead of throwing. Callers decide whether a given
 * validation failure is fatal for them.
 */
export function loadConfig(options: LoadConfigOptions = {}): LoadConfigResult {
  const { env, values, loadedFiles } = resolveValues(options);
  const featureReport = buildFeatureReport(values);

  return {
    env,
    config: buildConfig(values, env),
    values,
    features: toFeatureFlags(featureReport),
    featureReport,
    validation: validate(values, env),
    loadedFiles,
  };
}

export class ConfigValidationError extends Error {
  readonly result: ValidationResult;

  constructor(result: ValidationResult) {
    super(formatValidationError(result));
    this.name = "ConfigValidationError";
    this.result = result;
  }
}

export function formatValidationError(result: ValidationResult): string {
  const lines: string[] = [`Configuration is not valid for the ${result.env} environment.`];

  for (const entry of result.missing) {
    lines.push("", `Missing: ${entry.key}`, `  ${entry.message}`, `  How to obtain: ${entry.howToObtain}`);
    if (entry.blocksFeatures.length > 0) lines.push(`  Blocks: ${entry.blocksFeatures.join(", ")}`);
  }

  for (const entry of result.invalid) {
    lines.push("", `Invalid: ${entry.key}`, `  ${entry.message}`, `  How to obtain: ${entry.howToObtain}`);
  }

  return lines.join("\n");
}

/** Loads configuration and throws a fully explained error when it is unusable. */
export function loadConfigOrThrow(options: LoadConfigOptions = {}): LoadConfigResult {
  const result = loadConfig(options);
  if (!result.validation.ok) throw new ConfigValidationError(result.validation);
  return result;
}
