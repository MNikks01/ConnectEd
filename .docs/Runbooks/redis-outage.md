# Runbook — Redis Outage (Cache / Queue)

`Status: Accepted` · `Last updated: 2026-07-28`

Redis backs cache, rate-limit counters, refresh-session helpers, and the BullMQ job queue.

## Symptoms
- `/readyz` failing on Redis; cache hit-rate to zero; jobs not processing; rate-limit errors.

## Impact
- **Cache miss storm** → higher DB load/latency (degraded, not down — reads fall through to Postgres).
- **Queue unavailable** → notifications/side-effects delayed (not lost if producers handle enqueue failure).

## Mitigate
1. Confirm Redis health (managed console / `PING`); check memory/eviction and connections.
2. **Cache:** app should treat Redis as optional for reads — verify graceful fallback to DB; watch DB load and
   scale reads if needed.
3. **Enqueue path:** ensure API returns success only after durable state is written; if enqueue fails, the domain
   event is persisted (outbox) so the worker can retry once Redis is back — no lost notifications.
4. **Failover/restart** the Redis instance (HA promotes replica).

## Recover
- On restore, workers resume; drain any backlog (see `queue-backlog.md`).
- Verify rate-limiting and cache hit-rate return to normal.

## Follow-up
- If notifications were lost (no outbox), add the transactional outbox pattern; postmortem.
