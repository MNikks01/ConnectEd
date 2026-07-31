# CI/CD — Pipelines

`Status: Accepted` · `Last updated: 2026-07-28`

GitHub Actions. Turborepo scopes tasks to changed packages. Workflows live in `.github/workflows`.

## Workflows

### `ci.yml` — on PR + push to `development`

```
setup (pnpm, node, cache)  →  turbo run:
  - lint          (eslint)
  - format:check  (prettier --check)
  - type-check    (tsc --noEmit)
  - test          (vitest/jest: unit + integration, incl. permission-matrix)
  - build         (turbo build)
web-only:
  - lighthouse-ci + axe a11y (on preview build)
security:
  - pnpm audit / dependency review
  - secret scan (repo already enforces push protection)
services for integration tests: postgres + redis (compose or service containers)
```

### `changeset-check.yml` — on PR

Fails if shippable packages changed without a changeset (bot comment guides the author).

### `preview.yml` — on PR (optional)

Ephemeral preview deploy of `apps/web` (and API) for review.

### `release.yml` — on push to `main`

```
changesets action → version + changelog + tags
build & push images (api, web, worker) with immutable tags
migrate deploy (gated, with backup checkpoint)
deploy production (rolling/canary)
post-deploy smoke + health watch
```

### `codeql.yml` — scheduled + PR

Static analysis (CodeQL) for JS/TS.

## Principles

- **Fast feedback:** cache pnpm store + turbo; run only affected tasks on PRs.
- **Required checks:** lint, format, type-check, tests, build must pass to merge (branch protection).
- **CodeRabbit** runs alongside as AI review (config in `.coderabbit.yaml`); does not replace human approval.
- **No secrets in logs;** CI secrets via GitHub Encrypted Secrets/OIDC to cloud (no long-lived cloud keys).
- **Deterministic builds:** lockfile committed; `--frozen-lockfile` in CI.

## Local mirror of CI (via Husky)

- pre-commit: `lint-staged` (prettier + eslint on staged files).
- commit-msg: `commitlint`.
- pre-push: fast `type-check` + affected unit tests.
