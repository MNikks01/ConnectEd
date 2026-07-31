# Sprint 0 — Foundation

`Status: Done` · `Last updated: 2026-07-31` · Duration: 2 weeks

Goal: a running, observable, secure **platform skeleton** — no user-facing features. Maps to roadmap Phase 0.

## Sprint goal

> A developer can clone, `pnpm install`, `docker compose up`, run the API + web with a seeded Postgres, register
> and log in, and see request traces/metrics/logs — all through CI-gated, reviewed PRs following the git flow.

## Backlog (committed)

| #     | Item                                                          | Owner (agent)    | DoD                                              |
| ----- | ------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| S0-1  | Monorepo config (pnpm, turbo, tsconfig, eslint, prettier)     | devops/architect | `pnpm build/lint/type-check` green               |
| S0-2  | Husky + lint-staged + commitlint + changesets                 | devops           | hooks fire locally; changeset check in CI        |
| S0-3  | GitHub Actions CI (`ci.yml`) + branch protection              | devops           | required checks enforced on `development`/`main` |
| S0-4  | Docker Compose (postgres, redis, minio) + `.env.example`      | devops           | `docker compose up` healthy                      |
| S0-5  | API skeleton (Express, error mw, health/ready, logging, OTel) | backend          | `/healthz`,`/readyz`,`/metrics` respond          |
| S0-6  | Prisma schema v1 + first migration + seed                     | db               | `migrate dev` + `db seed` work                   |
| S0-7  | Auth module (register/login/refresh/logout, argon2, RBAC mw)  | backend/security | auth flow + permission tests pass                |
| S0-8  | Web skeleton (Next.js App Router, api-client, auth pages)     | frontend         | login works against API                          |
| S0-9  | Observability compose (prometheus/grafana/loki/tempo)         | devops           | dashboards show live traffic                     |
| S0-10 | CODEOWNERS, PR template, CodeRabbit config                    | architect        | review routing works                             |

## Ceremonies

- Planning (start), daily async standup, mid-sprint check, review + retro (end).

## Definition of Done (sprint)

All committed items merged to `development` via reviewed PRs, CI green, docs/ADRs updated, demo of the skeleton.

## Out of scope

Any product feature (institution/academics/social) — those start Sprint 1 (Phase 1).

## Review notes

**All ten items shipped**, each through a reviewed PR into `development` with CI green.

| Item        | PR  | Notes                                                                       |
| ----------- | --- | --------------------------------------------------------------------------- |
| S0-1..4, 10 | #1  | Tooling, hooks, CI, compose, review config.                                 |
| S0-5        | #3  | Reopened from #2 — see the git-flow note below.                             |
| S0-6        | #4  | Schema v1, migration, idempotent seed.                                      |
| S0-7        | #5  | Auth + server-enforced RBAC; 98 tests.                                      |
| S0-8        | #6  | Web skeleton; login works end to end.                                       |
| S0-9        | #7  | Prometheus/Grafana/Loki/Tempo with live dashboards and a firing alert test. |

**Defects found in our own accepted docs, and fixed:**

- `Database/03-rbac-data.md` named `UNIQUE(account_id, school_id, role, class_id, child_id)` as the guard
  against duplicate scopes. Postgres treats NULLs as distinct, so it would **not** have prevented duplicate
  `PRINCIPAL`/`TEACHER` memberships — the rows with the most authority. Replaced with a derived non-null
  `scope_key`; both schema docs corrected.
- `.gitignore` did not cover `.env`, despite `Setup/00-getting-started.md` stating that it did.
- `.env.example` specified `ACCESS_TOKEN_TTL=15m` and an 18-character signing secret; the API now requires
  seconds and a 32-character minimum.

**Deviations from accepted docs, each recorded in the doc itself:**

- Prisma 7 required a config file and driver adapter (`ADR-0013`); `Database/02-migrations.md` described the v6
  workflow.
- Access tokens are **HS256**, not the RS256/EdDSA + JWKS in `Security/01-authentication.md`. Flagged there as
  not-yet-built.
- The web app uses a BFF and httpOnly access cookie rather than an in-memory token
  (`Architecture/03-frontend-architecture.md`).

**Process issue:** PR #2 was stacked on #1 and merged _after_ its parent had already landed, stranding the work
and requiring #3 to redo it. `ci.yml` also runs no checks on stacked PRs, which reads as "pending" rather than
"absent". Carried into Sprint 1 as **S1-0**.

**Carry-over into Sprint 1:** asymmetric token signing + JWKS; `apps/web` has no tests; `packages/ui` is still a
placeholder; 4 of 5 documented dashboards await metrics no module emits yet; alert routing is unconfigured.

## Retro

_To be completed by the team at the retro — went well / didn't / actions with owners and due dates._
