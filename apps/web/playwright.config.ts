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
 * The standalone worker's metrics port, and the only thing it listens on — which is what makes it
 * usable as a readiness signal for `webServer` below.
 */
const WORKER_METRICS_PORT = 4811;
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
  // The smoke test lives alongside these but is not one of them: it runs against something already
  // deployed, from `smoke.config.ts`. Running it here would point it at this suite's servers and
  // quietly turn a deployment check into a duplicate of the E2E suite.
  testIgnore: '**/smoke.spec.ts',
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

  /**
   * **Chromium runs everything; the others run what engines actually differ on** (S9-17, NFR-011).
   *
   * Running the whole suite three times would triple a four-minute job to prove the same
   * assertions about the same server, and most of what it asserts — who may read a mark, what a
   * card contains — cannot vary by browser. What *can* vary is the part below the application:
   * cookie attributes and how they survive a redirect, form submission, and how a strict content
   * security policy with a per-response nonce is enforced. Those specs run everywhere.
   *
   * `narrow` is Chromium at 320px, which is the viewport NFR-011 names and the one nothing had
   * ever loaded a page at.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Not the responsive spec: at a desktop viewport it asserts nothing and would pass for the
      // wrong reason, which is the failure this sprint has spent its time finding.
      testIgnore: '**/responsive.spec.ts',
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: ['**/auth.spec.ts', '**/security-headers.spec.ts'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: ['**/auth.spec.ts', '**/security-headers.spec.ts'],
    },
    {
      name: 'narrow',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 720 } },
      testMatch: ['**/responsive.spec.ts'],
    },
  ],

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
        // Two-factor enrolment refuses to run without a key rather than storing secrets in the
        // clear, so the suite has to supply one to exercise the feature at all.
        TWO_FACTOR_KEY: 'e2e-only-two-factor-key-long-enough-32',
        LOG_LEVEL: 'warn',
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        METRICS_ENABLED: 'false',
        /**
         * **The deployment this suite is meant to prove.** With the worker in-process — the
         * default, and what every test ran under until S7-17 — `worker.ts` was never started by
         * anything, in any suite. It is the deployment the product uses when fan-out is heavy,
         * and since ADR-0019 it is where the outbox relay lives.
         *
         * Set to `false`, the API writes outbox rows and hands nothing to the queue; a *separate
         * process* drains them and fans out. `class-feed.spec.ts` — "published work reaches the
         * student's notification list" — therefore stops proving that fan-out works and starts
         * proving that it works across two processes, which is the only arrangement where the two
         * halves of ADR-0019 are actually apart.
         */
        RUN_WORKER_IN_PROCESS: 'false',
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
    /**
     * The worker, as its own process. It serves nothing but `/metrics`, which is why that port is
     * the readiness check: a worker that has not bound it has not finished booting, and Playwright
     * would otherwise start the suite against a queue nobody is consuming.
     */
    {
      command: 'node dist/worker.js',
      cwd: '../api',
      port: WORKER_METRICS_PORT,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        DATABASE_URL,
        JWT_ACCESS_SECRET: 'e2e-only-secret-that-is-long-enough-32',
        TWO_FACTOR_KEY: 'e2e-only-two-factor-key-long-enough-32',
        LOG_LEVEL: 'warn',
        WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
        // Its only listener, and the readiness signal above.
        METRICS_ENABLED: 'true',
        WORKER_METRICS_PORT: String(WORKER_METRICS_PORT),
        REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
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
        /**
         * **The production build, served over plain HTTP** — which is the point, and which makes a
         * `Secure` session cookie undeliverable. Chromium keeps one anyway on `localhost`; WebKit
         * drops it, and every sign-in fails with a redirect and no error. Explicit here rather than
         * inferred, so the suite says what it is doing (S9-17).
         */
        SESSION_COOKIE_SECURE: 'false',
      },
    },
  ],
});
