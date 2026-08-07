/**
 * Transactional outbox (ADR-0019).
 *
 * A domain change and the event announcing it commit together, and a relay hands the event to the
 * queue afterwards. What this buys is narrow and worth stating exactly: the event survives a
 * crash, a Redis outage, or a slow `queue.add` between the commit and the publish. It does not
 * make delivery exactly-once, and it does not replace the queue's retries.
 */
export {
  createOutboxRepository,
  recordEvent,
  type OutboxRepository,
  type OutboxRow,
  type OutboxTx,
} from './outbox.repository.js';

export { createRelay, type Relay, type RelayDeps, type RelayOptions } from './relay.js';
