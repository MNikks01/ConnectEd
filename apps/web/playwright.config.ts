/**
 * End-to-end tests.
 *
 * These run against the **real stack** — a built Next server talking to a built API talking to
 * Postgres. That is the point: every layer below has its own tests, and none of them would catch
 * a session cookie that the browser refuses to send back, a Server Action wired to the wrong
 * endpoint, or a redirect loop. Those only appear when a browser drives the whole thing.
 *
 * Playwright starts both servers itself, so `pnpm --filter web test:e2e` is the whole command.
 * `reuseExistingServer` keeps a local run fast when the servers are already up, but is disabled in
 * CI so a stale process cannot silently serve an old build.
 */
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4810;
const WEB_PORT = 3810;
/**
 * A database of its own, deliberately not `connected_test`. The API's vitest suite TRUNCATEs that
 * one between cases; sharing it means an end-to-end run and a unit run can delete each other's
 * data, producing failures that look like product bugs and vanish on retry.
 *
 * Create it once locally:
 *   docker compose exec postgres createdb -U connected connected_e2e
 *   DATABASE_URL=postgresql://connected:connected@localhost:5432/connected_e2e?schema=public \\
 *     pnpm --filter @connected/api db:deploy
 */
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://connected:connected@localhost:5432/connected_e2e?schema=public';

export default defineConfig({
  testDir: './e2e',
  // The suite shares one database, so parallel workers would truncate each other's fixtures.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Artefacts only for failures — enough to diagnose without bloating every green run.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'node dist/index.js',
      cwd: '../api',
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        API_PORT: String(API_PORT),
        DATABASE_URL,
        // Long enough that no test races the access-token expiry, short enough to stay realistic.
        JWT_ACCESS_SECRET: 'e2e-only-secret-that-is-long-enough-32',
        LOG_LEVEL: 'warn',
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        METRICS_ENABLED: 'false',
        // The suite registers far more accounts than a person would; see the config comment.
        RATE_LIMIT_ENABLED: 'false',
        REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
        // Required by config, so the API refuses to boot without them. MinIO runs alongside the
        // suite; uploads are not exercised end to end yet, but the server must start as it would
        // in production rather than in a reduced configuration.
        S3_ENDPOINT: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
        S3_BUCKET: process.env.S3_BUCKET ?? 'connected-e2e',
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? 'minioadmin',
        S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? 'minioadmin',
      },
    },
    {
      command: `pnpm exec next start --port ${WEB_PORT}`,
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api/v1`,
      },
    },
  ],
});
