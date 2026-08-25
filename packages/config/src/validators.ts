import type { ConfigKeyDefinition, ConfigValidator, ConfigValue } from './types.ts';

export function isUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol !== '';
  } catch {
    return false;
  }
}

export function isEvmAddress(raw: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(raw);
}

export function isHex(raw: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(raw);
}

export function isBooleanLike(raw: string): boolean {
  return ['true', 'false', '1', '0', 'yes', 'no'].includes(raw.trim().toLowerCase());
}

/** Values that mean "the operator has not filled this in yet". */
export function isPlaceholder(raw: string): boolean {
  const normalised = raw.trim().toLowerCase();
  if (normalised === '') return true;
  if (normalised.startsWith('<') && normalised.endsWith('>')) return true;
  return ['changeme', 'change_me', 'replace_me', 'replaceme', 'todo', 'xxx', '...'].includes(
    normalised,
  );
}

export function typeErrorFor(definition: ConfigKeyDefinition, raw: string): string | null {
  switch (definition.type) {
    case 'number':
      return Number.isFinite(Number(raw)) ? null : `expected a number, received "${raw}"`;
    case 'boolean':
      return isBooleanLike(raw) ? null : `expected true or false, received "${raw}"`;
    case 'url':
      return isUrl(raw) ? null : `expected an absolute URL (including scheme), received "${raw}"`;
    case 'address':
      return isEvmAddress(raw)
        ? null
        : 'expected a 20-byte EVM address (0x followed by 40 hex characters)';
    case 'hex':
      return isHex(raw) ? null : 'expected a 0x-prefixed hex string';
    case 'enum': {
      const allowed = definition.enumValues ?? [];
      return allowed.includes(raw)
        ? null
        : `expected one of ${allowed.join(', ')}, received "${raw}"`;
    }
    default:
      return null;
  }
}

export function coerce(definition: ConfigKeyDefinition, raw: string): ConfigValue {
  switch (definition.type) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return ['true', '1', 'yes'].includes(raw.trim().toLowerCase());
    default:
      return raw;
  }
}

export function numberRange(min: number, max: number): ConfigValidator {
  return (raw) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return `expected a number, received "${raw}"`;
    if (value < min || value > max) return `must be between ${min} and ${max}, received ${value}`;
    return null;
  };
}

export function exactHexLength(bytes: number): ConfigValidator {
  const characters = bytes * 2;
  return (raw) => {
    if (!isHex(raw)) return 'expected a 0x-prefixed hex string';
    if (raw.length - 2 !== characters) {
      return `expected ${bytes} bytes (${characters} hex characters after 0x), received ${raw.length - 2}`;
    }
    return null;
  };
}

export function oneOfProtocols(...protocols: readonly string[]): ConfigValidator {
  return (raw) => {
    if (!isUrl(raw)) return `expected an absolute URL (including scheme), received "${raw}"`;
    const protocol = new URL(raw).protocol.replace(':', '');
    if (!protocols.includes(protocol)) {
      return `expected a ${protocols.join(' or ')} URL, received "${protocol}"`;
    }
    return null;
  };
}
