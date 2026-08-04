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

**Built as of S5-13.** The browser batches its Core Web Vitals (LCP, CLS, INP, TTFB, FCP) and any uncaught
errors and sends them once, on `visibilitychange`, via `sendBeacon` — one beacon per page load rather than one
per metric, because the measurement must not cost more than what it measures. They reach `POST /rum` through
the web app's own origin.

| Metric              | Type      | Labels        |
| ------------------- | --------- | ------------- |
| `web_vital_seconds` | histogram | metric, route |
| `web_vital_cls`     | histogram | route         |
| `web_errors_total`  | counter   | route         |

CLS is separate because it is a **unitless** layout-shift score; in a metric named `_seconds` every dashboard
and alert over it would be quietly wrong.

**`/rum` is the only unauthenticated write in the API**, and is shaped entirely by that:

- **It stores nothing.** A body becomes a histogram observation and is discarded — no row to fill, nothing to
  read back.
- **The path never becomes a label.** `route` is derived server-side from a closed list of page patterns;
  anything unrecognised collapses to `other`. A label taken from a URL is one time series per URL, and a
  stranger who can mint labels can run up a metrics bill without touching the product. A large `other` on the
  dashboard means the list needs a page adding, not that the guard is wrong.
- **It answers 204 whatever it is sent** — malformed, oversized, rate-limited. A monitoring endpoint that
  reports its own failures teaches every visitor's browser to retry.
- Error _messages_ go to the logs, never a label: they are attacker-controlled and unbounded.

Product events (funnels from `Product/02-metrics.md`) to an analytics sink are **still not built**.

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
