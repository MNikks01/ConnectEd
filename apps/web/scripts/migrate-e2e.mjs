/**
 * Prepares the end-to-end run: builds what the suite serves, then migrates the database it talks to.
 *
 * CI does both as its own steps; locally nothing did. The migration half cost three full suite runs
 * in one day, each dying on a missing column. The build half cost worse: `playwright.config.ts` sets
 * `reuseExistingServer` locally and starts the API with `node dist/index.js`, so a run against a
 * two-day-old `dist` boots a server without the routes being tested and reports the absence as a
 * page error. Nothing in the output says "stale build" — it looks like a product defect, and it is
 * the same trap as the missing migration wearing a different coat.
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

const run = (args) =>
  execFileSync('pnpm', args, { stdio: 'inherit', env: { ...process.env, DATABASE_URL } });

// Both servers, because both are started from a build rather than from source: the API as
// `node dist/index.js`, the web app as `next start`, which serves whatever `.next` was left behind.
// A no-op rebuild is nearly free; a run against a stale one costs an afternoon.
run(['--filter', '@connected/api', 'build']);
run(['--filter', 'web', 'build']);
run(['--filter', '@connected/api', 'db:deploy']);
