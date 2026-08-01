import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Config validation and the logger read env at import time.
    // Integration tests TRUNCATE the shared test database between cases, so files must not run
    // concurrently — one file's reset would wipe another's fixtures mid-assertion.
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
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
