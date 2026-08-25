import { describe, expect, test } from 'bun:test';
import { loadConfig } from './load.ts';
import { displayValue, maskSecret, maskValue } from './mask.ts';
import { CONFIG_REGISTRY, REGISTRY_BY_KEY } from './registry.ts';

function definitionFor(key: string) {
  const definition = REGISTRY_BY_KEY[key];
  if (!definition) throw new Error(`${key} is missing from the config registry`);
  return definition;
}

const secretDefinition = definitionFor('DATABASE_URL');
const publicDefinition = definitionFor('PORT');

describe('maskSecret', () => {
  test('keeps a recognisable prefix and the last four characters', () => {
    expect(maskSecret('sk_live_1234567890abcd')).toBe('sk_live_\u2026abcd');
  });

  test('falls back to the first four characters when there is no prefix separator', () => {
    expect(maskSecret('abcdefghijklmnop')).toBe('abcd\u2026mnop');
  });

  test('never reveals part of a short value', () => {
    expect(maskSecret('short')).toBe('*****');
    expect(maskSecret('12345678')).toBe('********');
  });

  test('returns empty for empty input', () => {
    expect(maskSecret('')).toBe('');
  });
});

describe('maskValue', () => {
  test('masks secret keys', () => {
    const masked = maskValue(secretDefinition, 'postgresql://anyx:hunter2@db.internal:5432/anyx');
    expect(masked).not.toContain('hunter2');
    expect(masked).toContain('\u2026');
  });

  test('leaves non-secret keys readable', () => {
    expect(maskValue(publicDefinition, '3000')).toBe('3000');
    expect(displayValue(publicDefinition, 3000)).toBe('3000');
  });
});

describe('secret handling across the loader', () => {
  test('no resolved display value contains a secret in full', () => {
    const processEnv = {
      ANYX_ENV: 'dev',
      DATABASE_URL: 'postgresql://anyx:supersecretpassword@localhost:5432/anyx',
      PRIVATE_KEY: `0x${'a'.repeat(64)}`,
      STRIPE_SECRET_KEY: 'sk_test_do_not_use_this_value_anywhere',
    };

    const result = loadConfig({ env: 'dev', processEnv, skipFiles: true });

    for (const value of Object.values(result.values)) {
      if (!value.secret || value.raw === undefined) continue;
      expect(value.display).not.toBe(value.raw);
      expect(value.display.length).toBeLessThan(value.raw.length);
    }
  });

  test('every secret in the registry declares a non-realistic example', () => {
    for (const definition of CONFIG_REGISTRY) {
      if (!definition.secret) continue;
      expect(definition.example).toMatch(/[<>]/);
    }
  });
});
