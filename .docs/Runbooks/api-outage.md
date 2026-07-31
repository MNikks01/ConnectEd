# Runbook — API Outage / High Error Rate

`Status: Accepted` · `Last updated: 2026-07-28`

## Symptoms

- Availability SLO burn alert / error rate > 5% / `/healthz` failing / latency spike.

## Diagnose

1. Grafana **Service overview** → which routes, which status codes, since when.
2. Correlate with a recent deploy (release timeline) — most incidents follow a change.
3. Check dependencies: `/readyz`, DB (connections/replication), Redis, object storage, payment/push providers.
4. Loki: filter 5xx by `correlationId`/route; Tempo: inspect a failing trace end-to-end.

## Mitigate (fast)

- **If deploy-correlated:** roll back to the previous immutable image; disable the risky **feature flag**.
- **If capacity:** scale API replicas out; check DB pool saturation (raise pool or add replicas for reads).
- **If a dependency is down:** enable graceful degradation (serve cached reads; queue writes if safe); see the
  dependency's runbook.
- **If abuse/DoS:** tighten rate limits / WAF rules.

## Resolve

- Confirm error rate/latency back within SLO for a bake period.
- Re-enable anything disabled once healthy.

## Follow-up

- Postmortem (if Sev1/Sev2): timeline, root cause, action items, guardrail metric/alert to prevent recurrence.
