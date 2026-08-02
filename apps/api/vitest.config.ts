import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /**
     * Config validation and the logger read env at import time. Integration tests TRUNCATE the
     * shared test database between cases, so files must not run concurrently — one file's reset
     * would wipe another's fixtures mid-assertion.
     *
     * **Known unsolved (S4-12).** This is not sufficient, and the failure it does not prevent has
     * been misdiagnosed twice. What is established: a run occasionally fails asserting on data the
     * same test created moments earlier — a notice whose creation returned 201 and which was
     * absent from a list read immediately after — and one such run showed **two process ids**,
     * because vitest recycles the worker per file and a finishing process briefly coexists with
     * the next.
     *
     * Two fixes were tried and rejected:
     *
     * - `pool: 'forks'` + `poolOptions.forks.singleFork` — `poolOptions` no longer exists in
     *   Vitest 4, and `fileParallelism: false` already pins the run to one worker.
     * - `isolate: false`, which does put every file in one process — and leaks module state
     *   between them. It made `error-handling.test.ts` fail on a mocked logger that a previous
     *   file had already touched. A different fault, not a fix.
     *
     * Next thing to try: give each file its own Postgres schema, so a stray reset cannot reach
     * another file's rows at all.
     */
    fileParallelism: false,
    /**
     * Vitest's 5s default is tuned for unit tests. These talk to a real Postgres — a case that
     * resets the database, builds a fixture, and makes several HTTP round trips sits comfortably
     * under a second locally but has been observed at 5.1s under load. CI runners are slower than
     * a laptop, so the default would turn into intermittent red builds that say nothing about the
     * code.
     */
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Config requires these at boot. The value is a local test database, not a secret.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://connected:connected@localhost:5432/connected_test?schema=public',
      JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-32',
      RATE_LIMIT_ENABLED: 'false',
      // Config requires it; the unit suite publishes through a fake, never a real connection.
      REDIS_URL: 'redis://localhost:6379',
      // Config requires these; the media suite injects a fake Storage and never reaches MinIO.
      S3_ENDPOINT: 'http://localhost:9000',
      S3_BUCKET: 'connected-test',
      S3_ACCESS_KEY: 'test',
      S3_SECRET_KEY: 'test',
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
