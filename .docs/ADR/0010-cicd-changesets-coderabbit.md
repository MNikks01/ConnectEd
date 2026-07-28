# ADR-0010 — GitHub Actions + Changesets + CodeRabbit

Status: Accepted
Date: 2026-07-28

## Context

The user specified: Husky, Prettier, CodeRabbit, GitHub Actions CI/CD, and Changesets to record changes per PR,
with a branch flow of feature → `development` → `main` (production). We need this codified.

## Decision

- **CI/CD:** GitHub Actions. PR pipeline runs lint, type-check, unit + integration tests, build, and (on web)
  Lighthouse/a11y checks. Turbo scopes jobs to changed packages.
- **Changesets:** every PR that changes shippable code includes a changeset; release PRs aggregate changelogs and
  version bumps.
- **CodeRabbit:** AI review on every PR, complementing human review (does not replace CODEOWNERS approval).
- **Local gates:** Husky pre-commit runs lint-staged (Prettier + ESLint); commit-msg runs commitlint
  (Conventional Commits); pre-push runs type-check/tests (fast subset).
- **Branch flow:** `feature/*` → PR into `development` → merge → PR `development` → `main`. `main` is production.
  See [`CI-CD/00-git-flow.md`](../CI-CD/00-git-flow.md).

## Consequences

- **Positive:** consistent quality gates, automated changelog/versioning, fast feedback, protected production
  branch, layered review (human + CodeRabbit).
- **Negative:** contributors must author changesets and follow Conventional Commits; pipeline maintenance cost.
- **Follow-ups:** workflow YAML in `.github/workflows`, branch protection rules, CODEOWNERS, CodeRabbit config.

## Alternatives

- **semantic-release** instead of Changesets — great for single packages; Changesets fits monorepos with
  multiple versioned packages better.
- **CircleCI/GitLab CI** — GitHub Actions chosen for repo-native integration.
