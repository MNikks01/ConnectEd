# Success Metrics & KPIs

`Status: Accepted` · `Last updated: 2026-07-28`

## North-star metric

**Weekly Active Verified Members per onboarded school** — a school is only valuable when its members actually use
it for academics. Social-only usage is secondary.

## Metric tree

| Layer | Metric | Target (v1, 6 mo) |
|---|---|---|
| Acquisition | Schools onboarded | 25 pilot schools |
| Activation | Schools that set up ≥1 class + verify ≥10 members within 7 days | ≥ 70% |
| Activation | Member verification completion rate (request → verified) | ≥ 85% |
| Engagement | Weekly active verified members / verified members | ≥ 55% |
| Engagement | Homework read-rate within 24h of publish | ≥ 80% |
| Engagement | Median time from homework publish → parent notified | < 10 s |
| Retention | School month-2 retention | ≥ 90% |
| Retention | Member 4-week retention | ≥ 50% |
| Reliability | API availability (SLO) | ≥ 99.9% |
| Reliability | p95 read latency / p95 write latency | < 300 ms / < 600 ms |
| Business | Trial → paid school conversion | ≥ 30% |

## Instrumentation

- **Product analytics** on the web app (page/route views, feature events, funnels) — see
  [`../Monitoring/`](../Monitoring/) and the analytics-engineer agent.
- **Server metrics** (Prometheus): request rate, error rate, latency histograms, DB pool saturation.
- **Business events** emitted from the API domain layer (school.onboarded, member.verified, homework.published,
  notification.delivered) into an events table + analytics sink.

## Funnels to watch

1. **School onboarding:** sign up → profile → create class → add subjects → invite/verify members → first notice.
2. **Member verification:** register → declare role → submit verification request → school approves → class unlock.
3. **Homework loop:** teacher publishes → parents notified → parents open → marked read.

## Guardrail metrics (don't regress while chasing growth)

- Notification opt-out rate < 5%.
- Complaint volume per active member (spikes signal a broken flow).
- Auth error rate & failed-login rate (security guardrail).
