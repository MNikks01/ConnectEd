# Runbook — Job Queue Backlog / DLQ

`Status: Accepted` · `Last updated: 2026-07-28`

## Symptoms
- Queue-lag alert (p95 > 30s / backlog growing); notifications delayed; DLQ size rising.

## Diagnose
1. Grafana **Queue/worker** dashboard: incoming rate vs. processing rate, failures, DLQ size.
2. Are workers healthy/running? Enough replicas? Crashing (check logs by `correlationId`)?
3. Is a downstream (push/email provider, DB) slow or erroring?

## Mitigate
- **Throughput:** scale worker replicas; increase concurrency if downstream can absorb it.
- **Poison messages:** inspect DLQ; fix the handler or data; **replay** DLQ after fix.
- **Downstream slow:** back off, batch, or temporarily pause non-critical categories (digests) to protect
  critical ones (verification/leave/homework).
- **Idempotency:** safe to retry — dispatch is keyed by `(event_id, recipient_id)`.

## Recover
- Drain backlog to normal lag; empty/replay DLQ; confirm delivery success rate ≥ SLO.

## Follow-up
- Right-size worker autoscaling; add per-category priorities if not present; postmortem if user-visible delay was
  significant.
