export { parseDotenv } from './dotenv.ts';
export { buildFeatureReport, FEATURE_NAMES, featureKeys, toFeatureFlags } from './features.ts';
export { renderConfigurationDoc, renderEnvExample } from './generate.ts';
export type { JsonValue } from './jsonc.ts';
export { flattenJson, parseJsonc, stripJsonComments } from './jsonc.ts';
export {
  buildConfig,
  ConfigValidationError,
  formatValidationError,
  loadConfig,
  loadConfigOrThrow,
  resolveEnvironment,
  resolveValues,
  validate,
} from './load.ts';
export { displayValue, maskSecret, maskValue } from './mask.ts';
export {
  CONFIG_GROUPS,
  CONFIG_REGISTRY,
  FEATURE_DESCRIPTIONS,
  findKey,
  isRequired,
  keysForGroup,
  REGISTRY_BY_CONFIG_PATH,
  REGISTRY_BY_KEY,
  REQUIREMENT_RULES,
} from './registry.ts';
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
  RequiredByEnvironment,
  RequirementRule,
  ResolvedValue,
  ResolvedValues,
  ValidationIssue,
  ValidationResult,
} from './types.ts';
export { CONFIG_ENVIRONMENTS } from './types.ts';

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
} from './validators.ts';
