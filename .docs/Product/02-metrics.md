# Success Metrics & KPIs

`Status: Accepted` · `Last updated: 2026-08-11`

## North-star metric

**Weekly Active Verified Members per onboarded school** — a school is only valuable when its members actually use
it for academics. Social-only usage is secondary.

## Metric tree

| Layer       | Metric                                                          | Target (v1, 6 mo)   |
| ----------- | --------------------------------------------------------------- | ------------------- |
| Acquisition | Schools onboarded                                               | 25 pilot schools    |
| Activation  | Schools that set up ≥1 class + verify ≥10 members within 7 days | ≥ 70%               |
| Activation  | Member verification completion rate (request → verified)        | ≥ 85%               |
| Engagement  | Weekly active verified members / verified members               | ≥ 55%               |
| _(above)_   | _Computable since S9-15; shown on the school analytics page_    | —                   |
| Engagement  | Homework read-rate within 24h of publish                        | ≥ 80%               |
| Engagement  | Median time from homework publish → parent notified             | < 10 s              |
| Retention   | School month-2 retention                                        | ≥ 90%               |
| Retention   | Member 4-week retention                                         | ≥ 50%               |
| Reliability | API availability (SLO)                                          | ≥ 99.9%             |
| Reliability | p95 read latency / p95 write latency                            | < 300 ms / < 600 ms |
| Business    | Trial → paid school conversion                                  | ≥ 30%               |

## Instrumentation

- **Product analytics** on the web app (page/route views, feature events, funnels) — see
  [`../Monitoring/`](../Monitoring/) and the analytics-engineer agent.
- **Server metrics** (Prometheus): request rate, error rate, latency histograms, DB pool saturation.
- **Business events** emitted from the API domain layer into `product_event` — **built 2026-08-11
  (S9-15)**. Four types today: `school.onboarded`, `member.verified`, `academic.published` and
  `account.active`. Each answers a row below; anything that answers none is noise.

  **What building it found: the north star could not be computed.** Nothing in the schema recorded
  that a member had done anything — the only `lastSeenAt` belonged to a push token and meant "this
  device registered". Six of the eleven rows below had the same problem, because they have _time_ in
  them and an operational table knows its present state and has forgotten how it got there.

  `account.active` is stamped where a session is issued — login and every fifteen-minute refresh —
  and deduped to one row per account per UTC day. It measures sessions rather than intent: somebody
  who leaves a tab open is counted, which is the honest limit of every weekly-active number.

  **The analytics sink itself is not built**, and cannot be: there is nowhere to ship to until B-1
  is answered. The table is the half that cannot be backfilled — every week without it is a week of
  history that does not exist — and a shipper is a small later addition once a destination exists.

## Funnels to watch

1. **School onboarding:** sign up → profile → create class → add subjects → invite/verify members → first notice.
2. **Member verification:** register → declare role → submit verification request → school approves → class unlock.
3. **Homework loop:** teacher publishes → parents notified → parents open → marked read.

## Guardrail metrics (don't regress while chasing growth)

- Notification opt-out rate < 5%.
- Complaint volume per active member (spikes signal a broken flow).
- Auth error rate & failed-login rate (security guardrail).
