# Research & Spikes

`Status: Living` · `Last updated: 2026-07-28`

Home for time-boxed investigations and comparisons that inform decisions (which then become ADRs). One file per
spike: `NN-topic.md`.

## Template

```
# Spike NN — <question>
Status: Open | Done   Time-box: <e.g. 2 days>   Owner: <name>
## Question / hypothesis
## Options considered
## Findings (evidence, benchmarks, links)
## Recommendation  → (becomes ADR-XXXX if a decision)
```

## Backlog of spikes

| # | Topic | Why | Feeds |
|---|---|---|---|
| 01 | Real-time transport (polling vs SSE vs WebSocket) | Replace Firestore live listeners for messages/notifications | ADR (future) |
| 02 | Payment provider (Stripe vs Razorpay) | Pilot region drives choice | `PRD/08-billing`, ADR |
| 03 | Push provider (Expo vs FCM/APNs direct) for mobile phase | Server-owned push | `PRD/07-notifications` |
| 04 | Image processing pipeline (on-upload resize/optimize) | Media performance | `ADR-0009` |
| 05 | Postgres RLS as an authZ backstop | Defense-in-depth beyond service layer | `ADR-0006` follow-up |
| 06 | Search (Postgres FTS vs OpenSearch) | Member/school/post search | future |
| 07 | Deploy platform (K8s vs managed PaaS) | Prod topology | `Deployment/`, ADR |

## Legacy analysis reference

Product/domain background is reverse-engineered in `/docs` (the old Firebase app). Treat it as **domain research**,
not as a design to copy — the rebuild deliberately reverses several of its choices (see ADRs).
