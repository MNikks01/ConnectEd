# Architecture — Overview

`Status: Accepted` · `Last updated: 2026-07-28`

## Guiding principles

1. **The API is the only authority.** Clients (web now, mobile later) hold no business rules and never touch the
   database. This is the central reversal from the legacy Firebase design.
2. **Server-enforced authorization** on every request (role + verification + ownership).
3. **Stateless, horizontally scalable API**; all shared state in Postgres/Redis/object storage.
4. **Modular monolith first.** One deployable API organized into clear domain modules with enforced boundaries;
   extract services only when a boundary demonstrably needs independent scaling (`ADR-0012`).
5. **Transactional writes**, idempotent side effects, async fan-out via a job queue.

## C4 — Context

```mermaid
flowchart TB
  subgraph Users
    Ind[Individual: student/parent/teacher/principal/general]
    Sch[School admin]
  end
  Web[Next.js Web App]
  Mob[Mobile App - future]
  API[ConnectEd API - Express]
  DB[(PostgreSQL)]
  Redis[(Redis: cache/queue/sessions)]
  Obj[(Object storage: media)]
  Notif[Notification worker]
  Pay[Payment provider]
  Push[Push provider - mobile phase]

  Ind --> Web
  Sch --> Web
  Ind -. future .-> Mob
  Web --> API
  Mob -. future .-> API
  API --> DB
  API --> Redis
  API --> Obj
  API --> Pay
  Redis --> Notif
  Notif --> DB
  Notif --> Push
```

## C4 — Container

```mermaid
flowchart LR
  Web[apps/web Next.js] -->|REST + auth cookie/JWT| API[apps/api Express]
  API --> Prisma[Prisma Client] --> PG[(PostgreSQL)]
  API --> RedisC[Redis]
  API --> Storage[S3-compatible]
  API -->|enqueue| Queue[BullMQ on Redis]
  Worker[Notification/Job worker] --> Queue
  Worker --> PG
  subgraph packages
    Types[packages/types]
    UI[packages/ui]
    Config[packages/config]
  end
  Web -.uses.-> Types
  API -.uses.-> Types
  Web -.uses.-> UI
```

## Domain modules (inside the API)

`auth` · `accounts` · `institution` (schools, classes, subjects) · `verification` · `academics`
(homework/notices/events/timetable/syllabus) · `workflows` (leave, complaints) · `social` (posts/follow/
messaging) · `notifications` · `billing`. Each module owns its routes, services, repository access, and domain
types. Cross-module calls go through service interfaces, not direct table access. See
[`01-modules.md`](./01-modules.md).

## Request lifecycle

```mermaid
sequenceDiagram
  participant C as Client
  participant M as Middleware (auth, rate-limit, validation)
  participant Ctrl as Controller
  participant Svc as Domain Service
  participant Repo as Repository (Prisma)
  participant DB as PostgreSQL
  C->>M: HTTP request (+access token)
  M->>M: verify token, load actor, rate-limit, validate body
  M->>Ctrl: authorized request
  Ctrl->>Svc: call domain operation
  Svc->>Svc: authorize (role+verification+ownership)
  Svc->>Repo: read/write (transaction if multi-step)
  Repo->>DB: SQL
  Svc-->>Ctrl: result / domain events
  Ctrl-->>C: typed response
```

See also: [`01-modules.md`](./01-modules.md), [`02-sequence-flows.md`](./02-sequence-flows.md),
[`03-frontend-architecture.md`](./03-frontend-architecture.md).
