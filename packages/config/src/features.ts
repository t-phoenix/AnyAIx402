import { FEATURE_DESCRIPTIONS } from "./registry.ts";
import type { FeatureFlags, FeatureName, FeatureReportEntry, ResolvedValues } from "./types.ts";

type FeatureRule =
  | { readonly kind: "all"; readonly keys: readonly string[] }
  | { readonly kind: "any"; readonly keys: readonly string[] }
  | { readonly kind: "truthy"; readonly keys: readonly string[] };

const FEATURE_RULES: Readonly<Record<FeatureName, FeatureRule>> = {
  evmQuotes: { kind: "any", keys: ["ONEINCH_API_KEY", "ZEROX_API_KEY"] },
  solanaQuotes: { kind: "all", keys: ["RPC_URL_SOLANA", "JUPITER_API_URL"] },
  priceOracle: { kind: "all", keys: ["COINGECKO_API_KEY"] },
  onchainSwap: { kind: "all", keys: ["ANYX_ROUTER", "RPC_URL_BASE"] },
  floatSettlement: { kind: "all", keys: ["RESERVE_POOL"] },
  persistence: { kind: "all", keys: ["DATABASE_URL"] },
  quoteCache: { kind: "all", keys: ["REDIS_URL"] },
  rateLimiting: { kind: "all", keys: ["REDIS_URL"] },
  adminApi: { kind: "all", keys: ["API_SECRET"] },
  localSigner: { kind: "all", keys: ["PRIVATE_KEY"] },
  mpcSigner: { kind: "any", keys: ["TURNKEY_API_PRIVATE_KEY", "LIT_PROTOCOL_API_KEY"] },
  cdpFacilitator: { kind: "all", keys: ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"] },
  facilitatorFailover: { kind: "all", keys: ["FACILITATOR_FALLBACK_URL"] },
  crosschainCctp: { kind: "all", keys: ["CCTP_ATTESTER_URL", "RPC_URL_ETHEREUM"] },
  stargateBridge: { kind: "all", keys: ["STARGATE_ROUTER_ADDRESS"] },
  reserveFloat: { kind: "all", keys: ["RESERVE_POOL", "FLOAT_FUNDING_WALLET"] },
  lightning: { kind: "all", keys: ["LND_GRPC_HOST", "LND_TLS_CERT_PATH", "LND_MACAROON_PATH"] },
  stripeBilling: { kind: "all", keys: ["STRIPE_SECRET_KEY", "STRIPE_PRO_PRICE_ID", "STRIPE_WEBHOOK_SECRET"] },
  testnetDeploys: { kind: "all", keys: ["RPC_URL_BASE_SEPOLIA"] },
  contractVerification: { kind: "all", keys: ["BASESCAN_API_KEY"] },
  apiDeploy: { kind: "all", keys: ["FLY_API_TOKEN", "FLY_APP_API"] },
  sdkPublish: { kind: "all", keys: ["NPM_TOKEN"] },
  orchestratorRemoteExecutor: { kind: "all", keys: ["ORCHESTRATOR_AGENT_ENDPOINT"] },
  orchestratorProductionAutoApprove: { kind: "truthy", keys: ["ORCHESTRATOR_AUTO_APPROVE_PRODUCTION"] },
};

export const FEATURE_NAMES: readonly FeatureName[] = Object.keys(FEATURE_RULES) as FeatureName[];

function isSet(values: ResolvedValues, key: string): boolean {
  const resolved = values[key];
  if (!resolved) return false;
  if (resolved.value === undefined) return false;
  return String(resolved.value).trim() !== "";
}

function isTruthy(values: ResolvedValues, key: string): boolean {
  return values[key]?.value === true;
}

export function buildFeatureReport(values: ResolvedValues): readonly FeatureReportEntry[] {
  return FEATURE_NAMES.map((feature) => {
    const rule = FEATURE_RULES[feature];
    const unset = rule.keys.filter((key) =>
      rule.kind === "truthy" ? !isTruthy(values, key) : !isSet(values, key),
    );

    const enabled =
      rule.kind === "any" ? unset.length < rule.keys.length : unset.length === 0;

    return {
      feature,
      enabled,
      summary: FEATURE_DESCRIPTIONS[feature],
      missingKeys: enabled ? [] : unset,
    };
  });
}

export function toFeatureFlags(report: readonly FeatureReportEntry[]): FeatureFlags {
  const flags: Record<FeatureName, boolean> = {} as Record<FeatureName, boolean>;
  for (const entry of report) flags[entry.feature] = entry.enabled;
  return Object.freeze(flags);
}

export function featureKeys(feature: FeatureName): readonly string[] {
  return FEATURE_RULES[feature].keys;
}
