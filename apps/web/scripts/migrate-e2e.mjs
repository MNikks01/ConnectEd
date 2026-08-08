/**
 * Applies migrations to the end-to-end database before the suite runs.
 *
 * CI does this as its own step; locally nothing did, so a schema change meant a full suite run that
 * died on a missing column — three times in one day, at two minutes a go. The fix belongs in the
 * command rather than in a person's memory.
 *
 * **Wired into `test:e2e` rather than a `pretest:e2e` hook**, because pnpm does not run pre/post
 * scripts unless `enable-pre-post-scripts` is set, and this repository does not set it. A hook here
 * would look correct, never run, and put the failure back exactly where it was.
 *
 * `migrate deploy`, never `migrate dev`: this must not reset a database or invent a migration.
 */
import { execFileSync } from 'node:child_process';
// Imported rather than assumed: the shared ESLint config declares no Node globals for `.mjs`, and
// a bare `process` is an error there. Explicit is also honest — this file is a Node script living
// in a package whose other files are not.
import process from 'node:process';

/** Kept in step with `playwright.config.ts` — the suite and its migrations must agree. */
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://connected:connected@localhost:5432/connected_e2e?schema=public';

execFileSync('pnpm', ['--filter', '@connected/api', 'db:deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL },
});
