/**
 * Prisma CLI configuration (Prisma 7).
 *
 * Prisma 7 removed `url` from the `datasource` block in schema.prisma — connection details for
 * migrate/introspect live here instead, and the runtime client connects through a driver adapter.
 * See ADR-0013.
 */
import 'dotenv/config';

import { defineConfig } from 'prisma/config';

// `prisma generate` runs from `postinstall`, which on a fresh clone happens *before* anyone has
// copied .env.example to .env. Declaring the datasource unconditionally makes that install fail
// with "Cannot resolve environment variable: DATABASE_URL". Generate does not need a connection,
// so the datasource is declared only when it is actually available; migrate and studio still fail
// loudly (and correctly) when it is genuinely missing.
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Used by the CLI only (migrate, studio, introspect) — never by the running app.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
