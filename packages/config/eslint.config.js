// Shared flat ESLint config for ConnectEd. Apps/packages extend this.
// Enforces strict TS and the module-boundary intent from .docs/Architecture/01-modules.md.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', '.next/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      // No `any` at boundaries without justification (TRD NFR-013 / ADR-0003).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },
  // Config files (this file, prettier.config.js, …) are plain JS outside any tsconfig,
  // so typed rules cannot apply to them.
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  // NOTE: module-boundary import restrictions (no cross-module repository/Prisma imports)
  // will be added here via eslint no-restricted-imports once apps/api modules exist.
  prettier,
);
