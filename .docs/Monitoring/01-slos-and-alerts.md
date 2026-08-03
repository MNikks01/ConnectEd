# Monitoring — SLOs & Alerting

`Status: Accepted` · `Last updated: 2026-08-03`

## SLIs / SLOs

| SLI                                      | SLO         | Error budget  |
| ---------------------------------------- | ----------- | ------------- |
| API availability (non-5xx / total)       | 99.9% / 30d | 43m 12s / 30d |
| Read latency p95                         | < 300 ms    | —             |
| Write latency p95                        | < 600 ms    | —             |
| Homework publish → notification (median) | < 10 s      | —             |
| Notification delivery success            | ≥ 99.5%     | —             |
| Job queue processing lag p95             | < 30 s      | —             |

## Alerting policy

- **Page (urgent):** availability SLO burn-rate fast (2%/1h), API down, DB/Redis unreachable, error rate > 5% for
  5m, queue lag > 5m.
- **Ticket (non-urgent):** slow burn (10%/6h), latency creep, cache hit-rate drop, disk/CPU pressure, cert
  expiry < 14d.
- **Business alerts:** verification approval time spikes, notification failure rate up, login failure spike
  (possible attack).

## Routing

**Implemented as of S3-11, with one deviation:** routing is **Alertmanager**, not Grafana alerting. The rules
already lived in Prometheus (`infrastructure/prometheus/alerts.yml`), and Alertmanager is what Prometheus sends
to — routing them through Grafana would have meant a second rule engine and two places to look when something
did not page.

| Label              | Receiver | First notification | Repeats until acted on |
| ------------------ | -------- | ------------------ | ---------------------- |
| `severity: page`   | `oncall` | 10s                | hourly                 |
| `severity: ticket` | `chat`   | 30s                | every 12h              |

- Alerts group by `alertname` + `service`, so one bad deploy is one notification rather than forty.
- A **page inhibits the tickets** it would have caused for the same service: if the API is down, its latency is
  also bad, and the second notification tells the on-call nothing new.
- Receiver URLs come from **files mounted at runtime**, never from this repository. Locally there are no such
  files and everything lands in a null receiver — firing alerts are still visible in the Alertmanager UI on
  `:9093`, which is the local feedback loop.

Every alert links to a **runbook** (`../Runbooks/`) that exists. `scripts/check-alerts.mjs` runs in CI and fails
the build on an alert with no `severity`, no `service`, or a runbook path that does not resolve — `promtool`
validates the PromQL and has nothing to say about any of that.

**Closed as of S5-10.** Queue lag, dead-letter depth, fan-out failure rate, notification latency, and pool
exhaustion are all alertable now — 12 rules, up from 6. What made them impossible was never the rules; it was
that the API exported `http_request_duration_seconds` and the process defaults and nothing else.

**Still not alertable:** anything about the browser. Web Vitals and JS errors have no pipeline, so the
availability and latency SLOs are measured server-side only.

## Dashboards (in `infrastructure/grafana`)

| #   | Dashboard            | Built | What                                                                        |
| --- | -------------------- | :---: | --------------------------------------------------------------------------- |
| 1   | **Service overview** |  ✅   | RED per endpoint, availability, error budget burn.                          |
| 2   | **Database**         |  ✅   | Pool occupancy, waiting connections, request latency beside them.           |
| 3   | **Queue/worker**     |  ✅   | Depth by state, throughput by outcome, lag percentiles, dead-letter set.    |
| 4   | **Business**         |  ✅   | Onboarding funnel, publishing rates, fan-out latency, sign-in failures.     |
| 5   | **Web RUM**          |  ➖   | Core Web Vitals, JS errors — **not built**; nothing in the browser reports. |

Two panels the original list named are **absent from the Database dashboard**, and deliberately: slow-query
counts and replication lag come from Postgres itself, which nothing scrapes yet. A panel over an empty series
renders as a healthy database.

**A test enforces this.** `apps/api/src/__tests__/dashboards.test.ts` reads every panel query off disk, extracts
its metric names, and asserts the API's own `/metrics` registers each one. A dashboard whose panels query a
series nobody emits renders as a flat green board, which is worse than no dashboard because it is trusted —
that was the state of four of these five for four sprints.

## Health endpoints

`/healthz` (liveness) and `/readyz` (checks DB/Redis/storage) drive orchestrator probes and uptime monitoring.
