import { type AnyxDatabase, getDb as getDbClient } from '@anyx/db';

/**
 * Thin re-export so routes/middleware depend on a local module (easy to `vi.mock` in tests)
 * rather than reaching into `@anyx/db` directly everywhere.
 */
export function getDb(): AnyxDatabase {
  return getDbClient();
}

export type { AnyxDatabase };
