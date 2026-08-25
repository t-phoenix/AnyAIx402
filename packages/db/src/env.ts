/**
 * Minimal environment reader for `@anyx/db`.
 *
 * `@anyx/config` is the eventual single source of truth for configuration; this
 * helper exists so the package stays dependency-free and importable (types
 * included) without a live database or any config package present.
 */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? undefined : value;
}

export function databaseUrl(): string | undefined {
  return readEnv('DATABASE_URL');
}

export function requireDatabaseUrl(): string {
  const url = databaseUrl();
  if (!url) {
    throw new Error('DATABASE_URL is not set. Set it in .env.local or the process environment.');
  }
  return url;
}
