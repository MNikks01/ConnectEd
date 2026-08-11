/**
 * Recording the business events `.docs/Product/02-metrics.md` defines its metric tree in terms of
 * (S9-15).
 *
 * **The finding that made this worth building.** The declared north star is *Weekly Active Verified
 * Members per school*, and nothing in the schema recorded that a member had done anything — the
 * only `lastSeenAt` belonged to a push token and means "this device registered". Six of the eleven
 * metric-tree rows had the same problem: activation-within-seven-days, month-two retention and
 * four-week retention all need history, and history is the one thing an operational table does not
 * keep. The product could not measure the number it had chosen to be measured by.
 *
 * **This records facts, not content.** Payloads carry counts and ids. A row here outlives the thing
 * it describes — a notice can be withdrawn, a mark corrected, an account erased — so anything a
 * person typed would survive its own deletion, which is the opposite of what the erasure work
 * spent a day guaranteeing.
 *
 * Written inside the caller's transaction wherever there is one, for the same reason the outbox is
 * (ADR-0019): an event that can exist without its cause, or a cause without its event, makes every
 * later count a question rather than an answer.
 */
import type { Prisma } from '../../generated/prisma/client.js';

/** The transaction client, so a product event cannot be written outside its cause's transaction. */
export type ProductEventTx = Prisma.TransactionClient;

/**
 * The closed set, named after the metric they serve rather than after the code that emits them.
 *
 * Deliberately small. Every event here answers a row in the metric tree; anything that answers no
 * row is noise that costs storage and privacy surface, and "we might want it later" is how an
 * analytics table becomes a second copy of the database.
 */
export type ProductEventType =
  /** Activation funnel: a school exists. */
  | 'school.onboarded'
  /** Activation funnel: request → verified, and the time between them. */
  | 'member.verified'
  /** Engagement: the homework loop's first step. */
  | 'academic.published'
  /** Engagement and retention: the north star. One row per account per day, at most. */
  | 'account.active';

export interface ProductEventInput {
  type: ProductEventType;
  occurredAt?: Date;
  accountId?: string | undefined;
  schoolId?: string | undefined;
  payload?: Prisma.InputJsonValue | undefined;
  /**
   * Makes the write idempotent. Present for `account.active`, whose whole design is that a
   * hundred requests in a day produce one row; absent where a repeat is a real second occurrence.
   */
  dedupeKey?: string | undefined;
}

/**
 * The day an instant falls on, in UTC, as `YYYY-MM-DD`.
 *
 * UTC rather than the school's local day, and the trade is worth stating: a member active at
 * 00:30 in Delhi is counted against the previous UTC day. Every school in one timezone would make
 * a local day better; a product whose pilot is India-first and whose ambition is not confined to it
 * is better served by one unambiguous boundary than by a per-school one that makes two schools'
 * numbers incomparable.
 */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Writes one event.
 *
 * A duplicate `dedupeKey` is **not an error** — it is the mechanism working. `createMany` with
 * `skipDuplicates` rather than a catch, so the common path is one statement and no exception is
 * thrown on the request thread of somebody who simply signed in twice.
 */
export async function recordProductEvent(
  tx: ProductEventTx,
  event: ProductEventInput,
): Promise<void> {
  await tx.productEvent.createMany({
    data: {
      type: event.type,
      occurredAt: event.occurredAt ?? new Date(),
      ...(event.accountId ? { accountId: event.accountId } : {}),
      ...(event.schoolId ? { schoolId: event.schoolId } : {}),
      ...(event.payload === undefined ? {} : { payload: event.payload }),
      ...(event.dedupeKey ? { dedupeKey: event.dedupeKey } : {}),
    },
    skipDuplicates: true,
  });
}

/**
 * "This account did something today", recorded at most once per day.
 *
 * Stamped where a session is issued — login *and* every refresh — rather than per request. Access
 * tokens last fifteen minutes, so an active person refreshes through this path all day, and the
 * dedupe key collapses that to one row. Per-request stamping would add a write to every read in
 * the product to learn a fact that changes once a day.
 *
 * It is therefore a measure of *sessions*, not of intent: somebody who leaves a tab open is
 * counted. That is the honest limit of it, and it is the same limit every WAU number has.
 */
export async function recordAccountActive(
  tx: ProductEventTx,
  accountId: string,
  at: Date = new Date(),
): Promise<void> {
  await recordProductEvent(tx, {
    type: 'account.active',
    occurredAt: at,
    accountId,
    dedupeKey: `account.active:${accountId}:${utcDay(at)}`,
  });
}
