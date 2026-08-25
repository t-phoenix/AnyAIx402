export type {
  AnyxConfig,
  ConfigEnvironment,
  ConfigGroup,
  ConfigGroupMeta,
  ConfigKeyDefinition,
  ConfigSource,
  ConfigValidator,
  ConfigValue,
  ConfigValueType,
  FeatureFlags,
  FeatureName,
  FeatureReportEntry,
  LoadConfigOptions,
  LoadConfigResult,
  RequirementRule,
  RequiredByEnvironment,
  ResolvedValue,
  ResolvedValues,
  ValidationIssue,
  ValidationResult,
} from "./types.ts";

export { CONFIG_ENVIRONMENTS } from "./types.ts";

export {
  CONFIG_GROUPS,
  CONFIG_REGISTRY,
  FEATURE_DESCRIPTIONS,
  REGISTRY_BY_CONFIG_PATH,
  REGISTRY_BY_KEY,
  REQUIREMENT_RULES,
  findKey,
  isRequired,
  keysForGroup,
} from "./registry.ts";

export {
  ConfigValidationError,
  buildConfig,
  formatValidationError,
  loadConfig,
  loadConfigOrThrow,
  resolveEnvironment,
  resolveValues,
  validate,
} from "./load.ts";

export { FEATURE_NAMES, buildFeatureReport, featureKeys, toFeatureFlags } from "./features.ts";

export { displayValue, maskSecret, maskValue } from "./mask.ts";

export { parseDotenv } from "./dotenv.ts";
export { flattenJson, parseJsonc, stripJsonComments } from "./jsonc.ts";
export type { JsonValue } from "./jsonc.ts";

export { renderConfigurationDoc, renderEnvExample } from "./generate.ts";

export {
  coerce,
  exactHexLength,
  isBooleanLike,
  isEvmAddress,
  isHex,
  isPlaceholder,
  isUrl,
  numberRange,
  oneOfProtocols,
  typeErrorFor,
} from "./validators.ts";
