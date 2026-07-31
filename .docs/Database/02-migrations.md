# Database — Migrations & Seeding

`Status: Accepted` · `Last updated: 2026-07-28`

## Tooling

**Prisma Migrate**. `prisma/schema.prisma` is the source of truth; migrations live in `prisma/migrations` and are
committed. The Prisma client is generated into `node_modules/@prisma/client` and re-exported through a shared
`db` module in `apps/api/src/shared`.

## Workflow

| Situation                | Command                                                |
| ------------------------ | ------------------------------------------------------ |
| Change schema during dev | `pnpm --filter api prisma migrate dev --name <change>` |
| Apply in CI/staging/prod | `pnpm --filter api prisma migrate deploy`              |
| Regenerate client        | `pnpm --filter api prisma generate`                    |
| Inspect data             | `pnpm --filter api prisma studio`                      |
| Seed                     | `pnpm --filter api prisma db seed`                     |

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
