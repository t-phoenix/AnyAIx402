import { defineConfig } from 'drizzle-kit';

const DEFAULT_LOCAL_URL = 'postgresql://anyx:anyx@localhost:5432/anyx';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? DEFAULT_LOCAL_URL,
  },
  verbose: true,
  strict: true,
});
