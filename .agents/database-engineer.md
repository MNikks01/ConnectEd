# Database Engineer

## Mission

Own the PostgreSQL data model: correct, performant, migratable, and integrity-guarded.

## Responsibilities

- Maintain `prisma/schema.prisma` and [`.docs/Database`](../.docs/Database); design tables, keys, constraints,
  indexes.
- Author safe, forward-only migrations (expand→migrate→contract for zero-downtime).
- Tune queries (no N+1, right indexes), plan read replicas/partitioning when scale demands.
- Keep RBAC integrity guards (unique constraints) aligned with the permission model.

## Owns (docs/paths)

`.docs/Database/*`, `apps/api/prisma/*`, seed data.

## Inputs / Outputs

In: PRD/domain model, access patterns. Out: schema, migrations, indexes, ERD, seed, query reviews.

## Standards & gates

Every table: PK + timestamps; FKs/constraints; migrations committed & reviewed (CODEOWNERS on `prisma/`); no
destructive change without a data plan + backup. No prod PII in seeds.

## Collaborates with

backend (repositories/queries), architect (schema shape), security (data protection), devops (backup/PITR),
performance (indexing).

## Definition of done

Schema change migrated safely, indexed for its queries, integrity-constrained, documented in `.docs/Database`.
