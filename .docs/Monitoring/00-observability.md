# Monitoring — Observability

`Status: Accepted` · `Last updated: 2026-07-28`

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
- **Metrics**: `prom-client` — `http_request_duration_seconds` histogram (labels: route, method, status),
  `queue_jobs_total`, `db_pool_in_use`, business counters (`homework_published_total`, `member_verified_total`,
  `notification_dispatched_total`).
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
