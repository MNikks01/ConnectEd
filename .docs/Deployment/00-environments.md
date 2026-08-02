# Deployment — Environments & Topology

`Status: Accepted` · `Last updated: 2026-08-02`

## Environments

| Env          | Purpose             | Data                       | Deploy trigger                                |
| ------------ | ------------------- | -------------------------- | --------------------------------------------- |
| `local`      | Developer machine   | Seed/demo (Docker Compose) | manual                                        |
| `dev`        | Integration         | Anonymized/seed            | merge to `development`                        |
| `staging`    | Pre-prod, prod-like | Anonymized                 | merge to `development` (or release candidate) |
| `production` | Live                | Real                       | merge to `main` (gated)                       |

12-factor config: everything via env vars. No env-specific code branches.

## Topology (production)

```mermaid
flowchart TB
  CDN[CDN / WAF] --> WebEdge[Next.js app]
  CDN --> APILB[API load balancer]
  APILB --> API1[API instance]
  APILB --> API2[API instance]
  API1 --> PG[(PostgreSQL primary)]
  PG --> Replica[(read replica)]
  API1 --> Redis[(Redis)]
  Worker[Notification/job worker] --> Redis
  Worker --> PG
  API1 --> S3[(Object storage)]
  subgraph Observability
    Prom[Prometheus]
    Loki[Loki]
    Tempo[Tempo]
    Graf[Grafana]
  end
  API1 -. metrics/logs/traces .-> Observability
```

- **API**: stateless, ≥2 replicas behind a load balancer, autoscaled on CPU/RPS.
- **Web**: Next.js (Node server for SSR or platform edge). Static/ISR assets via CDN.
- **DB**: managed Postgres, primary + read replica, automated backups + PITR.
- **Redis**: managed/HA for cache + queue.
- **Worker**: separate process/deployment consuming BullMQ (first candidate for extraction).
- **Object storage**: S3/compatible + CDN for public assets.

## Scheduled work

The worker process runs housekeeping on a clock as well as consuming domain events. Schedules are BullMQ
repeatable jobs rather than a cron sidecar: Redis is already there, the schedule lives beside the code that
implements it, and **only one instance runs each job however many worker replicas are deployed** — a cron
container would have to be told which of them to call.

| Job                   | Schedule     | What it does                                                     |
| --------------------- | ------------ | ---------------------------------------------------------------- |
| `media:sweep-orphans` | `17 3 * * *` | Deletes uploads nothing ever referenced, older than 24h (S3-12). |

Off the hour on purpose — every scheduler in the world fires at `0 * * * *`, and a bucket sweep does not need
to compete with them.

## Packaging

- Multi-stage Docker images for `apps/api`, `apps/web`, and the worker. Minimal runtime base, non-root user,
  pinned deps, image scanning in CI (`ADR-0010`, `infrastructure/docker`).
- Orchestration: Docker Compose (local) → Kubernetes/Helm or a PaaS (staging/prod) — see
  `infrastructure/kubernetes` & `infrastructure/helm`. Final prod platform chosen at deploy time (its own ADR).

## Config & secrets

- Non-secret config in env per environment.
- Secrets from a secrets manager (never in repo); injected at runtime. `.env.example` documents required keys.
