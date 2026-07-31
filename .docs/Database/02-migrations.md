# Database — Migrations & Seeding

`Status: Accepted` · `Last updated: 2026-07-31`

## Tooling

**Prisma Migrate** (Prisma 7 — see [`../ADR/0013-prisma-7-driver-adapter.md`](../ADR/0013-prisma-7-driver-adapter.md)).
`prisma/schema.prisma` is the source of truth; migrations live in `prisma/migrations` and are committed.

Prisma 7 specifics that differ from older guides:

- The `datasource` block has **no `url`**. CLI connection details live in `apps/api/prisma.config.ts`; the
  running app passes its connection string to the `pg` driver adapter in `apps/api/src/shared/db`.
- The client is generated into `apps/api/src/generated/prisma` (gitignored) rather than `node_modules`, and is
  rebuilt by the `postinstall` hook — so a fresh clone must `pnpm install` before `type-check` will pass.

## Workflow

| Situation                | Command                                        |
| ------------------------ | ---------------------------------------------- |
| Change schema during dev | `pnpm --filter api db:migrate --name <change>` |
| Apply in CI/staging/prod | `pnpm --filter api db:deploy`                  |
| Regenerate client        | `pnpm --filter api exec prisma generate`       |
| Inspect data             | `pnpm --filter api db:studio`                  |
| Seed                     | `pnpm --filter api db:seed`                    |
| Reset local database     | `pnpm --filter api db:reset`                   |

## Rules

1. **Migrations are forward-only and committed.** Never edit an applied migration; add a new one.
2. **`migrate deploy` in every non-dev environment** (never `migrate dev`). CI runs it against staging before app
   deploy; prod runs it as a gated release step.
3. **Backwards-compatible first** for zero-downtime: expand → migrate data → contract. Add columns nullable,
   backfill, then enforce not-null/drop in a later migration.
4. **No destructive change without a data plan** and a backup checkpoint (see `Deployment/` + `Runbooks/`).
5. **Review**: schema PRs require DBA/architect review (CODEOWNERS on `prisma/`).

## Environments

- **local**: Postgres via Docker Compose; `migrate dev` + `db seed` with rich demo data.
- **dev/staging**: `migrate deploy` on each release; anonymized/seed data.
- **production**: `migrate deploy` gated in the release workflow; backup + PITR before schema-changing releases.

## Seeding

`prisma/seed.ts` provisions a demo world for local dev and E2E:

- 1 school (Greenwood), classes (Eng Class 8 A/B), subjects, a principal, class teachers.
- Verified students + parents (with children), a general user.
- Sample homework/notices/events, one leave application in each state, a few posts/messages.

Seed is **idempotent** (upserts by natural keys) so it can re-run.

## Backup & recovery (summary)

- Nightly logical backups + WAL archiving for **PITR**.
- RTO ≤ 1h, RPO ≤ 15 min (NFR-014). Restore drills documented in `Runbooks/db-restore.md`.
