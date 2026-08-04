# Monitoring — Observability

`Status: Accepted` · `Last updated: 2026-08-03`

Implements `ADR-0011`. Three signals, one pane of glass (Grafana).

## Signals

| Signal            | Tool                  | What                                                                                            |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Metrics           | Prometheus            | RED (Rate, Errors, Duration) per endpoint; queue depth; DB pool; cache hit rate; business KPIs. |
| Logs              | Loki                  | Structured JSON logs, correlated by `traceId`/`correlationId`.                                  |
| Traces            | Tempo (OpenTelemetry) | Distributed traces web → api → db/queue/providers.                                              |
| Dashboards/Alerts | Grafana               | Panels + alert rules over the above.                                                            |

## Instrumentation (in `apps/api`)

- **OpenTelemetry SDK** auto-instruments HTTP, Express, Prisma, Redis; custom spans around domain operations.
- **Metrics**: `prom-client`. What is actually exported, as of S5-10:

  | Metric                          | Type      | Labels                | Answers                                       |
  | ------------------------------- | --------- | --------------------- | --------------------------------------------- |
  | `http_request_duration_seconds` | histogram | route, method, status | RED, availability, latency SLOs               |
  | `domain_events_processed_total` | counter   | type, result          | Did the fan-out work?                         |
  | `domain_event_latency_seconds`  | histogram | type                  | Publish → notified, across the queue          |
  | `queue_job_wait_seconds`        | histogram | queue                 | Queue lag (30s p95 objective)                 |
  | `queue_jobs`                    | gauge     | queue, state          | Depth, and the dead-letter set                |
  | `db_pool_connections`           | gauge     | state                 | Pool exhaustion, before it looks like latency |

  Business figures are **derived from these**, not counted separately: verification decisions and publishing
  rates come from `domain_events_processed_total`, registrations from the request counter by route and status.
  A second counter beside an event that already carries the same fact is one more thing to keep in step.

- **The standalone worker serves its own `/metrics`** on `WORKER_METRICS_PORT` (4001). It has no HTTP server
  otherwise — but a worker split out for load is exactly the one whose lag and failures matter, and it would
  have been unscrapeable.
- **Logs**: pino JSON with `correlationId`, `traceId`, `accountId` (never PII/secrets). `/metrics` restricted to
  the monitoring network.

## Correlation

Every request gets/propagates `X-Correlation-Id`; the same id flows into logs and trace baggage so a single id
pivots across all three signals.

## RUM & product analytics (web)

- Web Vitals (LCP/CLS/INP/TTFB) + JS error tracking (Sentry-style).
- Product events (funnels from `Product/02-metrics.md`) to an analytics sink.

## Config location

Dashboards and alert rules are version-controlled in `infrastructure/grafana`, `infrastructure/prometheus`,
`infrastructure/loki`, `infrastructure/tempo`.

## Running it locally (as of S0-9)

```bash
docker compose --profile observability up -d
```

The stack sits behind a compose **profile**, so the everyday `docker compose up -d` still starts only Postgres,
Redis, and MinIO. Grafana is then on <http://localhost:3001> with anonymous admin — local convenience only.

| Service    | Port          | Notes                                                     |
| ---------- | ------------- | --------------------------------------------------------- |
| Grafana    | 3001          | 3000 belongs to the web app.                              |
| Prometheus | 9090          | Scrapes the host-run API via `host.docker.internal:4000`. |
| Tempo      | 3200, 4318/17 | 4318 is what `OTEL_EXPORTER_OTLP_ENDPOINT` points at.     |
| Loki       | 3100          | Set `LOKI_URL` for the API to ship to it.                 |

Two things worth knowing:

- **Configs are mounted read-only.** Dashboards and alerts are code; edits made in the Grafana UI are discarded
  on restart, so what runs is what was reviewed.
- **Log shipping differs by environment.** Deployed environments collect container stdout and leave `LOKI_URL`
  empty. Locally the API runs on the host, so nothing would collect it — setting `LOKI_URL` turns on a direct
  pino transport instead. It batches and fails silently, so Loki being down cannot take the API with it.
