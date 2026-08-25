import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Standalone migration runner: `bun run src/migrate.ts`.
 * Applies every migration in ./drizzle against DATABASE_URL, then exits.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('CONFIG_MISSING: DATABASE_URL is not set. Cannot run migrations.');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  console.log('Running migrations against', connectionString.replace(/:[^:@]+@/, ':****@'));
  await migrate(db, { migrationsFolder: new URL('../drizzle', import.meta.url).pathname });
  console.log('Migrations complete.');

  await sql.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
