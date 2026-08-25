/**
 * Core type definitions for the AnyX configuration registry.
 *
 * The registry is data, not code: every configuration key AnyX understands is
 * declared once here and consumed by the loader, the CLI, `.env.example`, and
 * `docs/configuration.md`. Nothing else in the monorepo should hard-code an
 * environment variable name.
 */

export type ConfigEnvironment = 'dev' | 'staging' | 'production';

export const CONFIG_ENVIRONMENTS: readonly ConfigEnvironment[] = ['dev', 'staging', 'production'];

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'url' | 'address' | 'hex' | 'enum';

export type ConfigValue = string | number | boolean;

export type ConfigGroup =
  | 'runtime'
  | 'network'
  | 'dex'
  | 'x402'
  | 'signer'
  | 'fees'
  | 'storage'
  | 'api'
  | 'contracts'
  | 'bridge'
  | 'lightning'
  | 'billing'
  | 'deploy'
  | 'orchestrator';

export interface ConfigGroupMeta {
  readonly group: ConfigGroup;
  readonly title: string;
  readonly summary: string;
}

export type FeatureName =
  | 'evmQuotes'
  | 'solanaQuotes'
  | 'priceOracle'
  | 'onchainSwap'
  | 'floatSettlement'
  | 'persistence'
  | 'quoteCache'
  | 'rateLimiting'
  | 'adminApi'
  | 'localSigner'
  | 'mpcSigner'
  | 'cdpFacilitator'
  | 'facilitatorFailover'
  | 'crosschainCctp'
  | 'stargateBridge'
  | 'reserveFloat'
  | 'lightning'
  | 'stripeBilling'
  | 'testnetDeploys'
  | 'contractVerification'
  | 'apiDeploy'
  | 'sdkPublish'
  | 'orchestratorRemoteExecutor'
  | 'orchestratorProductionAutoApprove';

export interface RequiredByEnvironment {
  readonly dev: boolean;
  readonly staging: boolean;
  readonly production: boolean;
}

/**
 * A validator receives the raw string as supplied by the operator and returns
 * an error message, or `null` when the value is acceptable.
 */
export type ConfigValidator = (raw: string) => string | null;

export interface ConfigKeyDefinition {
  /** Environment variable name. Also the canonical identifier of the key. */
  readonly key: string;
  readonly group: ConfigGroup;
  /** Dotted path inside `config/anyx.config.jsonc`, e.g. `network.rpcUrlBase`. */
  readonly configPath: string;
  readonly type: ConfigValueType;
  readonly enumValues?: readonly string[];
  readonly required: RequiredByEnvironment;
  /** Secrets are never printed, logged, or written to generated files. */
  readonly secret: boolean;
  readonly default?: ConfigValue;
  readonly description: string;
  /** A placeholder that is obviously a placeholder. Never a realistic credential. */
  readonly example: string;
  /** Step-by-step acquisition instructions, including the exact URL to visit. */
  readonly howToObtain: string;
  readonly docsUrl?: string;
  /** Product capabilities that stay disabled while this key is unset. */
  readonly blocksFeatures: readonly FeatureName[];
  readonly validate?: ConfigValidator;
}

/**
 * A rule that is satisfied by any one of several keys — used where AnyX accepts
 * alternatives, such as a local hot signer versus an MPC signer.
 */
export interface RequirementRule {
  readonly id: string;
  readonly title: string;
  readonly anyOf: readonly string[];
  readonly requiredIn: readonly ConfigEnvironment[];
  readonly howToObtain: string;
  readonly blocksFeatures: readonly FeatureName[];
}

export type ConfigSource =
  | 'process.env'
  | '.env.local'
  | '.env'
  | 'config/environments'
  | 'config/anyx.config'
  | 'default'
  | 'unset';

export interface ResolvedValue {
  readonly key: string;
  readonly group: ConfigGroup;
  readonly raw: string | undefined;
  readonly value: ConfigValue | undefined;
  readonly source: ConfigSource;
  readonly secret: boolean;
  /** The raw value, masked when the key is a secret. Safe to print. */
  readonly display: string;
}

export type ResolvedValues = Readonly<Record<string, ResolvedValue>>;

export interface ValidationIssue {
  readonly key: string;
  readonly group: ConfigGroup | 'multiple';
  readonly message: string;
  readonly howToObtain: string;
  readonly docsUrl?: string;
  readonly blocksFeatures: readonly FeatureName[];
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly env: ConfigEnvironment;
  readonly missing: readonly ValidationIssue[];
  readonly invalid: readonly ValidationIssue[];
  readonly warnings: readonly ValidationIssue[];
}

export interface FeatureReportEntry {
  readonly feature: FeatureName;
  readonly enabled: boolean;
  readonly summary: string;
  /** Keys that must be supplied to turn the feature on. */
  readonly missingKeys: readonly string[];
}

export type FeatureFlags = Readonly<Record<FeatureName, boolean>>;

export interface AnyxConfig {
  readonly env: ConfigEnvironment;
  readonly runtime: {
    readonly logLevel: string;
  };
  readonly network: {
    readonly rpcUrlBase: string;
    readonly rpcUrlEthereum: string;
    readonly rpcUrlBaseSepolia: string;
    readonly rpcUrlSolana: string;
    readonly defaultChainId: number;
  };
  readonly dex: {
    readonly oneInchApiKey: string | undefined;
    readonly zeroExApiKey: string | undefined;
    readonly jupiterApiUrl: string;
    readonly coingeckoApiKey: string | undefined;
    readonly defaultSlippageBps: number;
    readonly priority: readonly string[];
    readonly quoteTimeoutMs: number;
  };
  readonly x402: {
    readonly facilitatorUrl: string;
    readonly facilitatorFallbackUrl: string | undefined;
    readonly facilitatorTimeoutMs: number;
    readonly maxTimeoutSeconds: number;
    readonly cdpApiKeyId: string | undefined;
    readonly cdpApiKeySecret: string | undefined;
  };
  readonly signer: {
    readonly mode: string;
    readonly privateKey: string | undefined;
    readonly maxUsdcPerSession: number;
    readonly turnkeyApiPublicKey: string | undefined;
    readonly turnkeyApiPrivateKey: string | undefined;
    readonly turnkeyOrganizationId: string | undefined;
    readonly turnkeyPrivateKeyId: string | undefined;
    readonly litApiKey: string | undefined;
    readonly litPkpPublicKey: string | undefined;
    readonly litNetwork: string;
  };
  readonly fees: {
    readonly feeBps: number;
    readonly minFeeUsdc: number;
    readonly feeBpsStable: number;
    readonly feeBpsEth: number;
    readonly feeBpsBtc: number;
    readonly feeBpsCrosschain: number;
    readonly maxFeeBps: number;
  };
  readonly storage: {
    readonly databaseUrl: string | undefined;
    readonly databasePoolMax: number;
    readonly redisUrl: string | undefined;
    readonly quoteCacheTtlSeconds: number;
  };
  readonly api: {
    readonly port: number;
    readonly baseUrl: string;
    readonly secret: string | undefined;
    readonly anyxApiKey: string | undefined;
    readonly corsAllowedOrigins: string;
    readonly rateLimitFreeRpm: number;
    readonly rateLimitProRpm: number;
  };
  readonly contracts: {
    readonly usdcBase: string;
    readonly permit2: string;
    readonly anyxRouter: string | undefined;
    readonly feeCollector: string | undefined;
    readonly reservePool: string | undefined;
    readonly basescanApiKey: string | undefined;
  };
  readonly bridge: {
    readonly cctpAttesterUrl: string;
    readonly stargateRouter: string | undefined;
    readonly floatPoolTargetUsdc: number;
    readonly floatFundingWallet: string | undefined;
    readonly pollIntervalMs: number;
    readonly maxWaitSeconds: number;
  };
  readonly lightning: {
    readonly lndGrpcHost: string | undefined;
    readonly lndTlsCertPath: string | undefined;
    readonly lndMacaroonPath: string | undefined;
    readonly invoiceExpirySeconds: number;
    readonly btcRateBufferBps: number;
  };
  readonly billing: {
    readonly stripeSecretKey: string | undefined;
    readonly stripeProPriceId: string | undefined;
    readonly stripeWebhookSecret: string | undefined;
    readonly stripePortalReturnUrl: string | undefined;
  };
  readonly deploy: {
    readonly flyApiToken: string | undefined;
    readonly flyAppApi: string;
    readonly flyAppLightning: string;
    readonly healthcheckUrl: string;
    readonly npmToken: string | undefined;
  };
  readonly orchestrator: {
    readonly agentCommand: string;
    readonly agentEndpoint: string | undefined;
    readonly maxFixAttempts: number;
    readonly concurrency: number;
    readonly autoApproveProduction: boolean;
    readonly stateDir: string;
  };
}

export interface LoadConfigOptions {
  readonly env?: ConfigEnvironment;
  /** Repository root used to locate `.env`, `.env.local`, and `config/`. */
  readonly cwd?: string;
  /** Overrides `process.env`; primarily for tests. */
  readonly processEnv?: Readonly<Record<string, string | undefined>>;
  /** Skip reading `.env`, `.env.local`, and `config/*` from disk. */
  readonly skipFiles?: boolean;
}

export interface LoadConfigResult {
  readonly env: ConfigEnvironment;
  readonly config: AnyxConfig;
  readonly values: ResolvedValues;
  readonly features: FeatureFlags;
  readonly featureReport: readonly FeatureReportEntry[];
  readonly validation: ValidationResult;
  /** Files that were read, in decreasing order of precedence. */
  readonly loadedFiles: readonly string[];
}
