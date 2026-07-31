# Monitoring — SLOs & Alerting

`Status: Accepted` · `Last updated: 2026-07-28`

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

Grafana alerting → on-call (paging) for urgent, chat/ticket for the rest. Every alert links to a **runbook**
(`../Runbooks/`) and a dashboard. No alert without an owner and a runbook.

## Dashboards (in `infrastructure/grafana`)

1. **Service overview** — RED per endpoint, availability, error budget burn.
2. **Database** — connections, slow queries, replication lag, cache hit.
3. **Queue/worker** — throughput, lag, failures, DLQ size.
4. **Business** — onboarding funnel, verification rate, homework read-rate, notification latency.
5. **Web RUM** — Core Web Vitals, JS errors.

## Health endpoints

`/healthz` (liveness) and `/readyz` (checks DB/Redis/storage) drive orchestrator probes and uptime monitoring.
