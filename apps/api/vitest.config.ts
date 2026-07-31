import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Config validation and the logger read env at import time.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Config requires this at boot. The unit suite never opens a connection; integration tests
      // that do are gated on a reachable database.
      DATABASE_URL: 'postgresql://connected:connected@localhost:5432/connected_test?schema=public',
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
    },
  },
});
