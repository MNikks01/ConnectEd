# Technical Requirements Document (TRD)

`Status: Accepted` · `Last updated: 2026-07-28`

Defines **how** the system must behave. Pairs with the PRD (what) and Architecture (structure).

## Technology stack (decided — see ADRs)

| Layer          | Choice                                          | ADR        |
| -------------- | ----------------------------------------------- | ---------- |
| Monorepo       | pnpm workspaces + Turborepo                     | `ADR-0002` |
| Language       | TypeScript (strict) everywhere                  | `ADR-0003` |
| Frontend       | Next.js (App Router) + React                    | `ADR-0004` |
| Backend        | Node.js + Express                               | `ADR-0005` |
| Data layer     | Prisma ORM                                      | `ADR-0005` |
| Database       | PostgreSQL                                      | `ADR-0001` |
| Auth           | JWT access + rotating refresh, argon2id hashing | `ADR-0007` |
| AuthZ          | Server-enforced RBAC + verification             | `ADR-0006` |
| Cache/queue    | Redis (cache, sessions, BullMQ jobs)            | `ADR-0008` |
| Object storage | S3-compatible (media)                           | `ADR-0009` |
| CI/CD          | GitHub Actions + Changesets + CodeRabbit        | `ADR-0010` |
| Observability  | Prometheus, Grafana, Loki, Tempo                | `ADR-0011` |

## Non-functional requirements

| ID      | Category        | Requirement                                                                                  |
| ------- | --------------- | -------------------------------------------------------------------------------------------- |
| NFR-001 | Availability    | API SLO ≥ 99.9% monthly.                                                                     |
| NFR-002 | Latency         | p95 read < 300 ms, p95 write < 600 ms (excl. media upload).                                  |
| NFR-003 | Throughput      | Sustain 500 RPS baseline; degrade gracefully to 2000 RPS burst.                              |
| NFR-004 | Scalability     | API stateless & horizontally scalable; sessions/cache external (Redis).                      |
| NFR-005 | Security        | OWASP ASVS L2 target; all authZ server-side; secrets never in code.                          |
| NFR-006 | Privacy         | Passwords hashed (argon2id); PII encrypted at rest where required; GDPR-style delete/export. |
| NFR-007 | Data integrity  | Multi-write operations transactional; idempotent external effects (notifications, webhooks). |
| NFR-008 | Observability   | Structured logs w/ correlation IDs; RED metrics; distributed tracing across web→api→db.      |
| NFR-009 | Testability     | ≥ 80% coverage on domain/services; permission matrix covered by integration tests.           |
| NFR-010 | Portability     | Runs via Docker Compose locally; container images for all deploy targets.                    |
| NFR-011 | Compatibility   | Support latest 2 versions of evergreen browsers; responsive from 320px up.                   |
| NFR-012 | Accessibility   | WCAG 2.1 AA on the web app.                                                                  |
| NFR-013 | Maintainability | Strict TS, lint/format gates, ADRs for significant decisions, CLAUDE.md per package.         |
| NFR-014 | Recoverability  | Nightly DB backups; PITR; documented RTO ≤ 1h, RPO ≤ 15 min.                                 |
| NFR-015 | Rate limiting   | Auth + write endpoints rate-limited; abuse throttled.                                        |
| NFR-016 | I18n-ready      | Copy externalised; English + Hindi first (matches mediums).                                  |

## Environments

`local` (Docker Compose) → `dev` → `staging` → `production`. Config via env vars only (12-factor). See
[`../Deployment/`](../Deployment/).

## Constraints & assumptions

- School accounts are **web-only** (enforced by client type on the auth endpoint).
- Media is never served from the app server directly — signed URLs from object storage.
- No business logic in the client; the API is the sole authority.
