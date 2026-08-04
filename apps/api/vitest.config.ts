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
     * **A local-only flake lives here, and it is worth knowing before chasing it (S4-12).**
     *
     * Roughly one local run in four fails asserting on data the same test created moments earlier
     * — a notice whose creation returned 201 and which was absent from a list read immediately
     * after — or on a token that was just signed. **CI has never reproduced it: 20 consecutive
     * `verify` jobs green.** The difference is the developer machine, where the same Postgres
     * serves `connected`, `connected_test` and `connected_e2e` while E2E servers, dev servers and
     * Docker are running alongside.
     *
     * Three fixes were tried and rejected, so the next attempt does not repeat them:
     *
     * - `pool: 'forks'` + `poolOptions.forks.singleFork` — `poolOptions` no longer exists in
     *   Vitest 4, and `fileParallelism: false` already pins the run to one worker.
     * - `isolate: false` puts every file in one process, and leaks module state between them: it
     *   made `error-handling.test.ts` fail on a mocked logger another file had touched. A
     *   different fault, not a fix.
     * - A per-file Postgres advisory lock, so a finishing worker cannot overlap the next. It did
     *   serialise the files; the failure rate did not measurably change, so it was reverted rather
     *   than kept as complexity that pays for nothing.
     *
     * **S5-12, fourth attempt.** Two things were done rather than a fourth guess at the cause:
     *
     * - `support/db.ts` now refuses to start when another vitest process is already on this
     *   database. Two runs sharing one database TRUNCATE each other's fixtures, which produces
     *   exactly this signature — a wrong answer rather than an error, only on a machine where
     *   something else might be running, never in CI where the job owns its database.
     * - A 401 now records *why* the token was refused, in the logs and never in the response.
     *   "a token that was just signed" was the least explicable of the observed shapes, and it
     *   was unexplicable because nothing anywhere recorded which check had failed.
     *
     * **Neither is a proven fix and this comment stays until one is.** Ten consecutive local runs
     * were green afterwards, against two failures earlier the same day — suggestive, not proof.
     *
     * A related finding, unrelated to the flake but worth knowing: Prisma 7.9.1's pg adapter
     * issues concurrent `client.query` calls on a single transaction client (visible as a pg
     * deprecation warning under `--trace-deprecation`, from `PgTransaction.performIO`). pg 8
     * queues them, so results are correct today; **pg 9 removes that queue**. The `^8` range in
     * `package.json` holds it back, and must not be widened without checking upstream.
     *
     * **It appeared again (S6-8), and the S5-12 guard did not catch it** — two tests in two files,
     * no second vitest process, green on rerun. So a shared database is not the whole story, and
     * the rerun destroyed the evidence again. `support/forensics.ts` now dumps the row counts and
     * every other connection *before* anyone can rerun: an empty database where the fixture should
     * be is the truncate signature, and a populated one rules it out. Whichever it turns out to be
     * will be the first real fact this has produced.
     *
     * If it appears again, the next thing to try is a database per test file.
     */
    /**
     * Dumps the database's state when a test fails, before a rerun can destroy it (S6-11).
     * Silent for files that never touched the database.
     */
    setupFiles: ['./src/__tests__/support/forensics.ts'],
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
