/**
 * The outbox's data access. Prisma lives here and nowhere else in this folder
 * (`apps/api/CLAUDE.md` rule 1) — the relay works against this interface, so it can be tested
 * without a database.
 */
import { envelope, type DomainEvent, type PublishableEvent } from '../events/index.js';

import type { Db } from '../db/index.js';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * The subset of a Prisma client a caller needs to record an event.
 *
 * Typed as the transaction client rather than `Db` on purpose: the whole point is that this is
 * called *inside* someone else's transaction, and accepting the full client would let a caller
 * write an event outside one without noticing.
 */
export type OutboxTx = Prisma.TransactionClient;

export interface OutboxRow {
  id: string;
  eventId: string;
  attempts: number;
  payload: DomainEvent;
}

export interface OutboxRepository {
  /** Claims up to `limit` unpublished events, skipping rows another relay already holds. */
  claim: (limit: number) => Promise<OutboxRow[]>;
  markPublished: (ids: string[]) => Promise<void>;
  markFailed: (id: string, error: string) => Promise<void>;
  /** Unpublished count, for the depth gauge. A relay that stops shows up here and nowhere else. */
  depth: () => Promise<number>;
  /** Removes published rows older than the cutoff. Returns how many went. */
  sweep: (publishedBefore: Date) => Promise<number>;
}

/**
 * Writes an event in the caller's transaction. Returns the envelope it wrote, so a caller that
 * needs the id — a test, mostly — does not have to read it back.
 *
 * This is the entire atomicity guarantee: the row lands with the domain change or neither does.
 */
export async function recordEvent(tx: OutboxTx, event: PublishableEvent): Promise<DomainEvent> {
  const full = envelope(event);

  await tx.outboxEvent.create({
    data: {
      eventId: full.eventId,
      type: full.type,
      payload: full as unknown as Prisma.InputJsonValue,
      occurredAt: new Date(full.occurredAt),
    },
  });

  return full;
}

export function createOutboxRepository(db: Db): OutboxRepository {
  return {
    /**
     * `FOR UPDATE SKIP LOCKED` inside a transaction, which is what makes more than one relay safe:
     * a second one skips the rows the first is holding rather than blocking on them or, worse,
     * publishing them a second time.
     *
     * Double publication would in fact be harmless — the queue job id is the event id, so BullMQ
     * drops the duplicate — but "harmless because something downstream catches it" is a weaker
     * guarantee than not doing it.
     */
    claim: async (limit) => {
      return db.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string; event_id: string; attempts: number; payload: DomainEvent }[]
        >`
          SELECT id, event_id, attempts, payload
          FROM outbox_event
          WHERE published_at IS NULL
          ORDER BY created_at
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        return rows.map((row) => ({
          id: row.id,
          eventId: row.event_id,
          attempts: row.attempts,
          payload: row.payload,
        }));
      });
    },

    markPublished: async (ids) => {
      if (ids.length === 0) return;

      await db.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: { publishedAt: new Date(), lastError: null },
      });
    },

    /**
     * `attempts` counts up rather than the row being abandoned. A publish that keeps failing is a
     * Redis that is down, and a Redis that is down comes back — dropping the event at attempt N
     * would reintroduce exactly the loss this table exists to prevent. The count is there to be
     * alerted on, not to give up on.
     */
    markFailed: async (id, error) => {
      await db.outboxEvent.update({
        where: { id },
        data: { attempts: { increment: 1 }, lastError: error.slice(0, 500) },
      });
    },

    depth: async () => db.outboxEvent.count({ where: { publishedAt: null } }),

    sweep: async (publishedBefore) => {
      const { count } = await db.outboxEvent.deleteMany({
        where: { publishedAt: { not: null, lt: publishedBefore } },
      });

      return count;
    },
  };
}
