# ADR-0019 — A domain event commits with the change that produced it

`Status: Accepted` · `Date: 2026-08-06` · Supersedes: — · Superseded by: —

## Context

Until now, publishing a domain event looked like this (`shared/queue/index.ts`):

```ts
try {
  await withTimeout(queue.add(full.type, full, { jobId: full.eventId }), PUBLISH_TIMEOUT_MS);
} catch (error) {
  // The domain change already committed; failing the caller now would report an error for
  // something that succeeded. The event is lost, which is why this logs at error level.
  logger.error({ err: error, type: full.type }, 'Failed to publish domain event');
}
```

Both halves of that comment are correct, and together they describe a hole. The service has
committed a homework item; the teacher has had their `201`. If Redis is unreachable, or slow enough
to trip the two-second bound, the event is gone. Nobody in that class is told, nothing retries, and
the only evidence is a line in a log.

Swallowing the error was the right call and remains so — a verification decision must not fail
because a queue is down. The mistake was treating "do not fail the caller" and "do not lose the
event" as the same choice. They are not, and the reason they looked like the same choice is that
the event was only ever created _after_ the transaction it describes had closed.

This was recorded in `PRD/10-completeness.md` as the one carried engineering gap, and planned as
S7-1.

## Decision

**A domain event is a row, written in the same transaction as the change it announces. A relay
hands it to the queue afterwards.**

- `outbox_event` holds the whole envelope — the same JSON the consumer receives.
- Repositories call `recordEvent(tx, event)` inside their existing transaction. Where a repository
  had no transaction, it grows one.
- The event carries the id of a row that does not exist until the insert has run, so repositories
  take a `toEvent(row)` callback rather than a finished event. A service that built the event after
  the call would be back where it started: a committed write and an event that may never exist.
- A relay claims unpublished rows with `FOR UPDATE SKIP LOCKED`, enqueues each, and stamps
  `published_at`. It runs wherever the worker runs.
- `attempts` counts up; rows are never abandoned. A published row is swept after it is old enough,
  so "did that go out?" stays answerable for a while.

## What this does and does not buy

**Does:** an event survives a crash between commit and publish, a Redis outage of any length, and a
slow `queue.add`. The number of events waiting is a gauge, `outbox_events_unpublished`, which is the
only place a stopped relay is visible — a dead relay produces an _empty_ queue, indistinguishable
from a quiet afternoon.

**Does not:** make delivery exactly-once. It is still at-least-once, and consumers are still
idempotent on `eventId` — the relay can enqueue and then fail before stamping the row, and will
enqueue again. The queue's job id is the event id, so BullMQ drops the duplicate; the consumer's
`(event_id, recipient_id)` key catches anything BullMQ's history window has forgotten.

**Does not replace BullMQ.** Retries, backoff and the failed set stay the queue's job. The outbox
closes exactly one hole: the handoff _into_ the queue. A design where the outbox becomes the queue
is a much larger change, and this is not it.

## Alternatives

**Leave it.** Defensible for a long time — a missed notification is not a lost homework item, and
the row the teacher created is safe either way. Rejected because the failure is silent: nobody finds
out from the product that a class was not told, and the log line is only read by someone who already
suspects.

**Publish inside the transaction.** Makes the queue a participant in every write. A slow Redis
becomes a slow database, and a failed publish rolls back a homework item that was perfectly valid —
the exact behaviour the original catch existed to prevent.

**Two-phase commit across Postgres and Redis.** Redis does not offer it, and if it did, the
operational cost of distributed transactions is far past what a missed notification justifies.

**Listen to the write-ahead log (CDC/Debezium).** A real answer at a different scale. It needs a
connector, a Kafka-shaped thing to publish into, and replication slots to operate. For one queue and
one worker it is more moving parts than the problem has.

## Consequences

- Every module that publishes an event moves its write into a transaction. Eight call sites; the
  academics module is done, the rest follow in S7-2.
- `EventPublisher` survives only until then. Once nothing calls it, the publish-and-hope path goes
  with it.
- One more table on the write path — an insert alongside a write that was already happening, in a
  transaction that was usually already open.
- The relay is a process that must be running. That is a new way to be broken, and the reason the
  depth gauge shipped with it rather than after it.
