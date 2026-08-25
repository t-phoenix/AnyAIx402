import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type AnyxDatabase = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: AnyxDatabase | null = null;
let cachedSql: ReturnType<typeof postgres> | null = null;

/**
 * Creates (or returns the cached) Drizzle client for the given connection string.
 * Lazily instantiated so importing this module never opens a socket by itself —
 * important for unit tests that must not require a live Postgres connection.
 */
export function createDb(connectionString: string): AnyxDatabase {
  const sql = postgres(connectionString, { max: 10 });
  return drizzle(sql, { schema });
}

/**
 * Returns a process-wide singleton DB client backed by `DATABASE_URL`.
 * Throws a descriptive error (not a raw connection error) if the env var is missing.
 */
export function getDb(): AnyxDatabase {
  if (cachedDb) return cachedDb;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'CONFIG_MISSING: DATABASE_URL is not set. Copy .env.example to .env.local and set DATABASE_URL, ' +
        'or run `docker-compose up -d` for local Postgres (see docs/CONFIGURATION.md Tier 0).',
    );
  }

  cachedSql = postgres(connectionString, { max: 10 });
  cachedDb = drizzle(cachedSql, { schema });
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end();
    cachedSql = null;
    cachedDb = null;
  }
}
