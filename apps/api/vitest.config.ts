import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Config validation and the logger read env at import time.
    // Integration tests TRUNCATE the shared test database between cases, so files must not run
    // concurrently — one file's reset would wipe another's fixtures mid-assertion.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Config requires these at boot. The value is a local test database, not a secret.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://connected:connected@localhost:5432/connected_test?schema=public',
      JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-32',
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
