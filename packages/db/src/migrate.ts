import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDatabase } from './client.js'

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url))

export async function runMigrations(url?: string): Promise<void> {
  const handle = createDatabase(url ? { url } : {})
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER })
  } finally {
    await handle.close()
  }
}

if (import.meta.main) {
  runMigrations()
    .then(() => {
      console.log('[anyx/db] migrations applied')
      process.exit(0)
    })
    .catch((error: unknown) => {
      console.error('[anyx/db] migration failed:', error)
      process.exit(1)
    })
}
