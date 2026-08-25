import type { ConfigKeyDefinition, ConfigValue } from "./types.ts";

const ELLIPSIS = "\u2026";

/**
 * Renders a secret in a form that is recognisable to its owner but useless to
 * anyone else: a short prefix, an ellipsis, and the last four characters
 * (`sk_live_abcdef123456` becomes `sk_live_…3456`).
 */
export function maskSecret(value: string): string {
  if (value.length === 0) return "";
  if (value.length <= 8) return "*".repeat(value.length);

  const underscore = value.lastIndexOf("_", 11);
  const prefix = underscore > 0 ? value.slice(0, underscore + 1) : value.slice(0, 4);
  return `${prefix}${ELLIPSIS}${value.slice(-4)}`;
}

export function maskValue(definition: ConfigKeyDefinition, raw: string | undefined): string {
  if (raw === undefined || raw === "") return "";
  return definition.secret ? maskSecret(raw) : raw;
}

export function displayValue(definition: ConfigKeyDefinition, value: ConfigValue | undefined): string {
  if (value === undefined) return "";
  return maskValue(definition, String(value));
}
