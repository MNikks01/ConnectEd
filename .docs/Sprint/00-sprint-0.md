# Sprint 0 — Foundation

`Status: Planned` · `Last updated: 2026-07-28` · Duration: 2 weeks

Goal: a running, observable, secure **platform skeleton** — no user-facing features. Maps to roadmap Phase 0.

## Sprint goal

> A developer can clone, `pnpm install`, `docker compose up`, run the API + web with a seeded Postgres, register
> and log in, and see request traces/metrics/logs — all through CI-gated, reviewed PRs following the git flow.

## Backlog (committed)

| # | Item | Owner (agent) | DoD |
|---|---|---|---|
| S0-1 | Monorepo config (pnpm, turbo, tsconfig, eslint, prettier) | devops/architect | `pnpm build/lint/type-check` green |
| S0-2 | Husky + lint-staged + commitlint + changesets | devops | hooks fire locally; changeset check in CI |
| S0-3 | GitHub Actions CI (`ci.yml`) + branch protection | devops | required checks enforced on `development`/`main` |
| S0-4 | Docker Compose (postgres, redis, minio) + `.env.example` | devops | `docker compose up` healthy |
| S0-5 | API skeleton (Express, error mw, health/ready, logging, OTel) | backend | `/healthz`,`/readyz`,`/metrics` respond |
| S0-6 | Prisma schema v1 + first migration + seed | db | `migrate dev` + `db seed` work |
| S0-7 | Auth module (register/login/refresh/logout, argon2, RBAC mw) | backend/security | auth flow + permission tests pass |
| S0-8 | Web skeleton (Next.js App Router, api-client, auth pages) | frontend | login works against API |
| S0-9 | Observability compose (prometheus/grafana/loki/tempo) | devops | dashboards show live traffic |
| S0-10 | CODEOWNERS, PR template, CodeRabbit config | architect | review routing works |

## Ceremonies

- Planning (start), daily async standup, mid-sprint check, review + retro (end).

## Definition of Done (sprint)

All committed items merged to `development` via reviewed PRs, CI green, docs/ADRs updated, demo of the skeleton.

## Out of scope

Any product feature (institution/academics/social) — those start Sprint 1 (Phase 1).
