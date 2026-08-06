/**
 * The relay: moves committed events out of the outbox and onto the queue (ADR-0019).
 *
 * It is deliberately dull. The interesting property is not in this file but in the transaction
 * that wrote the row — this only has to be honest about what it managed to hand over.
 *
 * **It does not replace BullMQ.** Retries, backoff and the dead-letter set are still the queue's
 * job. The outbox closes exactly one hole: the gap between a domain change committing and its
 * event reaching Redis, which used to be a log line and a lost notification.
 */
import type { DomainEvent } from '../events/index.js';
import type { Logger } from '../logger/index.js';
import type { OutboxRepository } from './outbox.repository.js';

export interface RelayDeps {
  repository: OutboxRepository;
  /** Hands one event to the queue. Throws if it did not get there — unlike the old publisher. */
  enqueue: (event: DomainEvent) => Promise<void>;
  logger: Logger;
  /** Reports how many events are waiting. Called after every pass. */
  onDepth?: (depth: number) => void;
}

export interface RelayOptions {
  /** How many events one pass claims. Small: a pass holds locks for its duration. */
  batchSize?: number;
  /** How long to wait after an empty pass. A pass that found work runs again immediately. */
  idleMs?: number;
}

export interface Relay {
  /** One pass. Returns how many events were handed over — exposed so tests need no clock. */
  drain: () => Promise<number>;
  start: () => void;
  stop: () => Promise<void>;
}

export function createRelay(deps: RelayDeps, options: RelayOptions = {}): Relay {
  const { repository, enqueue, logger, onDepth } = deps;
  const batchSize = options.batchSize ?? 50;
  const idleMs = options.idleMs ?? 1000;

  let running = false;
  let loop: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;

  async function drain(): Promise<number> {
    const claimed = await repository.claim(batchSize);
    if (claimed.length === 0) {
      onDepth?.(0);
      return 0;
    }

    const published: string[] = [];

    for (const row of claimed) {
      try {
        await enqueue(row.payload);
        published.push(row.id);
      } catch (error) {
        // One event failing must not strand the rest of the batch — a single malformed payload
        // would otherwise block every event behind it for as long as it kept failing.
        await repository.markFailed(row.id, error instanceof Error ? error.message : String(error));
        logger.warn(
          { eventId: row.eventId, type: row.payload.type, attempts: row.attempts + 1, err: error },
          'Outbox event not handed to the queue; it stays in the outbox',
        );
      }
    }

    await repository.markPublished(published);

    if (onDepth) onDepth(await repository.depth());

    return published.length;
  }

  return {
    drain,

    start: () => {
      if (running) return;
      running = true;

      loop = (async () => {
        while (running) {
          let handed = 0;

          try {
            handed = await drain();
          } catch (error) {
            // A pass that throws is a database problem, not an event problem. Log and wait —
            // exiting the loop would stop the relay for the lifetime of the process, which is the
            // failure mode nobody notices until notifications stop.
            logger.error({ err: error }, 'Outbox relay pass failed');
          }

          if (!running) break;

          // Work found means there is probably more; an empty pass means there is not.
          if (handed === 0) {
            await new Promise<void>((resolve) => {
              timer = setTimeout(resolve, idleMs);
            });
          }
        }
      })();
    },

    stop: async () => {
      running = false;
      if (timer) clearTimeout(timer);
      await loop;
    },
  };
}
