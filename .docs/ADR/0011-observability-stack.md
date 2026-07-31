# ADR-0011 — Observability: Prometheus, Grafana, Loki, Tempo

Status: Accepted
Date: 2026-07-28

## Context

The checklists demand structured logging with correlation IDs, RED metrics, distributed tracing, and dashboards.
The `infrastructure/` layout the user provided already lists grafana/prometheus/loki/tempo. We need a coherent,
open-source, self-hostable stack.

## Decision

Adopt the **Grafana observability stack**:

- **Prometheus** — metrics (request rate, error rate, latency histograms, queue depth, DB pool saturation).
- **Loki** — centralized structured logs, correlated by trace/correlation ID.
- **Tempo** — distributed tracing across web → api → db/queue (OpenTelemetry instrumentation).
- **Grafana** — dashboards + alerting over all three.

The API emits OpenTelemetry traces + Prometheus metrics; logs are structured JSON with `traceId`/`correlationId`.

## Consequences

- **Positive:** single pane of glass, open-source/self-hostable, correlation across logs/metrics/traces, matches
  the provided infra folders.
- **Negative:** operational overhead to run the stack; instrumentation discipline required in code.
- **Follow-ups:** dashboards + alert rules in `infrastructure/grafana` & `infrastructure/prometheus`; SLOs and
  alert routing in `Monitoring/`; OTel setup in `apps/api`.

## Alternatives

- **Datadog/New Relic (SaaS)** — less ops, but cost and vendor lock-in; may adopt for production later.
- **ELK stack** — heavier; Loki is lighter and Grafana-native.
