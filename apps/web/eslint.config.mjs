// Package ESLint config — shared flat config plus the Next.js rules.
import config from '@connected/config/eslint';

export default [
  // Build output and generated types are not ours to lint.
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...config,
];
