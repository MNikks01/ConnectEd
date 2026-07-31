# ADR-0008 — Redis for cache, sessions, and job queue

Status: Accepted
Date: 2026-07-28

## Context

We need: (a) a cache for hot reads, (b) storage for refresh-token families / rate-limit counters, and (c) an
async job queue for notification fan-out and other side effects (the legacy client-side fan-out must move
server-side and become reliable/retryable). Firestore's free real-time listeners are gone (`ADR-0001`), so
near-real-time features need our own mechanism.

## Decision

Use **Redis** for caching, ephemeral auth/rate-limit state, and as the backing store for **BullMQ** job queues
(notification dispatch, webhook processing, digests). Websocket fan-out (later, for messaging/notifications) also
coordinates through Redis pub/sub.

## Consequences

- **Positive:** reliable, retryable async work with backoff + dead-letter; fast cache; simple rate limiting;
  scales the notification loop independently via workers.
- **Negative:** another stateful dependency to run/monitor/back up; must handle Redis outages gracefully
  (`Runbooks/`).
- **Follow-ups:** BullMQ queue definitions in the API; worker process in `apps/api` (or a dedicated worker
  entrypoint); Redis in Docker Compose + infra.

## Alternatives

- **In-process queue** — rejected: lost on restart, no horizontal scaling, no retries.
- **Postgres-based queue (e.g. pg-boss)** — viable and one-fewer-dependency; Redis chosen for cache+queue+pubsub
  in one and better throughput. Revisit if we want to drop Redis.
- **Managed queue (SQS)** — reasonable in cloud; keeps local dev heavier. Deferred.
