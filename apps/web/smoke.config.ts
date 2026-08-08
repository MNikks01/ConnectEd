/**
 * The smoke test's configuration (S9-2, S9-5).
 *
 * **No `webServer`.** This runs against something already running and somewhere else: a compose
 * stack, or a staging deployment a moment after it was rolled out. Starting a server here would
 * mean testing a build of the source rather than the artefact that was deployed, which is the
 * whole distinction.
 *
 *   docker compose -f infrastructure/docker/compose.yml up -d --build
 *   pnpm --filter web test:smoke
 *
 * Against a deployment:
 *
 *   SMOKE_WEB_URL=https://staging.example SMOKE_API_URL=https://api.staging.example/api/v1 \
 *     pnpm --filter web test:smoke
 */
import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const WEB_URL = process.env.SMOKE_WEB_URL ?? 'http://localhost:3000';

// `accounts.ts` reads this to register its fixtures through the API rather than seeding a database
// it has no access to — which is the only way to create an account on a deployment.
process.env.E2E_API_URL = process.env.SMOKE_API_URL ?? 'http://localhost:4000/api/v1';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/smoke.spec.ts',
  // One retry, because a deploy that has just finished rolling may still be draining an old
  // instance. Two would start hiding a real intermittent failure in the thing being gated.
  retries: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: { baseURL: WEB_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
