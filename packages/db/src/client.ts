import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseUrl, requireDatabaseUrl } from './env.js';
import * as schema from './schema.js';

export type AnyXSchema = typeof schema;
export type AnyXDatabase = PostgresJsDatabase<AnyXSchema>;

export interface DatabaseHandle {
  db: AnyXDatabase;
  /** Underlying postgres.js connection; exposed for health checks and shutdown. */
  sql: postgres.Sql;
  close: () => Promise<void>;
}

export interface CreateDatabaseOptions {
  url?: string;
  maxConnections?: number;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
  logQueries?: boolean;
}

/**
 * postgres.js connects lazily, so this never performs I/O — safe to call at
 * module load time in environments without a running database.
 */
export function createDatabase(options: CreateDatabaseOptions = {}): DatabaseHandle {
  const url = options.url ?? requireDatabaseUrl();
  const sql = postgres(url, {
    max: options.maxConnections ?? 10,
    idle_timeout: options.idleTimeoutSeconds ?? 30,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
    onnotice: () => {},
  });
  const db = drizzle(sql, { schema, logger: options.logQueries ?? false });
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}

/** Returns `null` when `DATABASE_URL` is absent, for degraded-mode startup. */
export function tryCreateDatabase(options: CreateDatabaseOptions = {}): DatabaseHandle | null {
  const url = options.url ?? databaseUrl();
  if (!url) return null;
  return createDatabase({ ...options, url });
}

export async function pingDatabase(handle: DatabaseHandle, timeoutMs = 2_000): Promise<boolean> {
  const timeout = new Promise<never>((_resolve, reject) => {
    setTimeout(() => reject(new Error('database ping timed out')), timeoutMs).unref?.();
  });
  try {
    await Promise.race([handle.sql`select 1`, timeout]);
    return true;
  } catch {
    return false;
  }
}
