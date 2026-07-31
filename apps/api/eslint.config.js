// Package ESLint config — re-exports the shared flat config from @connected/config.
import config from '@connected/config/eslint';

export default [
  // The Prisma client is generated code: not ours to lint, and large enough to slow every run.
  { ignores: ['src/generated/**', 'dist/**'] },
  ...config,
];
