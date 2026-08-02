# Architecture Decision Records

`Status: Accepted` · `Last updated: 2026-07-28`

ADRs capture **significant, hard-to-reverse decisions** with their context and consequences. Once `Accepted`,
an ADR is **immutable** — to change a decision, write a new ADR that supersedes it (and set the old one's status
to `Superseded by ADR-NNNN`).

## Format

```
# ADR-NNNN — Title
Status: Proposed | Accepted | Superseded by ADR-XXXX
Date: YYYY-MM-DD
## Context      (forces at play)
## Decision     (what we chose)
## Consequences (positive, negative, follow-ups)
## Alternatives (considered and why rejected)
```

## Index

| ADR                                          | Title                                           | Status   |
| -------------------------------------------- | ----------------------------------------------- | -------- |
| [0001](./0001-postgresql.md)                 | PostgreSQL as primary datastore                 | Accepted |
| [0002](./0002-monorepo-turborepo.md)         | pnpm workspaces + Turborepo monorepo            | Accepted |
| [0003](./0003-typescript-strict.md)          | TypeScript strict everywhere                    | Accepted |
| [0004](./0004-nextjs-frontend.md)            | Next.js (App Router) for web                    | Accepted |
| [0005](./0005-express-prisma.md)             | Express + Prisma for the API                    | Accepted |
| [0006](./0006-server-enforced-authz.md)      | Server-enforced authorization (reverse legacy)  | Accepted |
| [0007](./0007-auth-jwt-refresh.md)           | JWT access + rotating refresh, argon2id         | Accepted |
| [0008](./0008-redis-cache-queue.md)          | Redis for cache, sessions, and job queue        | Accepted |
| [0009](./0009-object-storage-media.md)       | S3-compatible object storage for media          | Accepted |
| [0010](./0010-cicd-changesets-coderabbit.md) | GitHub Actions + Changesets + CodeRabbit        | Accepted |
| [0011](./0011-observability-stack.md)        | Prometheus/Grafana/Loki/Tempo observability     | Accepted |
| [0012](./0012-modular-monolith.md)           | Modular monolith over microservices (initially) | Accepted |
| [0013](./0013-prisma-7-driver-adapter.md)    | Prisma 7 with the `pg` driver adapter           | Accepted |
| [0014](./0014-asymmetric-access-tokens.md)   | Ed25519 access tokens with a published JWKS     | Accepted |
