/**
 * What the suite says when it cannot empty the database — S6-13.
 *
 * `resetDb` TRUNCATEs every table between cases, which needs ACCESS EXCLUSIVE on all of them. One
 * connection left idle inside a transaction is enough to block that, and a blocked truncate is
 * indistinguishable from a slow one until something times out. So `resetDb` sets a lock timeout and
 * then, on failure, asks Postgres who is holding it — a failure that names the blocker instead of a
 * symptom several steps away.
 *
 * **That message had never once printed.** The lock timeout was five seconds and Prisma's own
 * interactive-transaction timeout defaults to five seconds, so the two raced; Prisma usually won and
 * reported *"A commit cannot be executed on an expired transaction"*, which describes a commit
 * nobody was waiting on. By the time the blocker query ran the blocker had gone, and the
 * diagnostics finished the job by reporting "no other active connection found".
 *
 * It surfaced under an end-to-end run against a different database on the same Postgres — the
 * shared-machine contention the vitest config has described since S4 — where a truncate that
 * ordinarily takes milliseconds took eleven seconds.
 *
 * This test holds the lock deliberately and asserts the message, so the diagnostics cannot rot back
 * into silence.
 */
import pg from 'pg';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  assertDbReachable,
  resetDb,
  testDb,
  TRUNCATE_LOCK_TIMEOUT_MS,
  TRUNCATE_TRANSACTION_TIMEOUT_MS,
} from './support/db.js';

let blocker: pg.Client | undefined;

beforeAll(async () => {
  testDb();
  await assertDbReachable();
});

afterEach(async () => {
  // Released even when an expectation fails, or every later file in the run inherits the lock.
  if (blocker) {
    await blocker.query('ROLLBACK').catch(() => undefined);
    await blocker.end().catch(() => undefined);
    blocker = undefined;
  }
});

/** A connection sitting idle inside a transaction, holding the table the truncate wants. */
async function holdTheLock(): Promise<void> {
  blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await blocker.connect();
  await blocker.query(`SET application_name = 'connected-test-blocker'`);
  await blocker.query('BEGIN');
  await blocker.query('LOCK TABLE "public"."account" IN ACCESS EXCLUSIVE MODE');
}

describe('when the truncate is blocked', () => {
  it('fails with the blocker named, not with a story about a commit', async () => {
    await holdTheLock();

    // Five seconds of lock timeout, well inside the hook budget.
    await expect(resetDb()).rejects.toThrow(/resetDb could not truncate/);
  });

  it('reports what was holding it', async () => {
    await holdTheLock();

    // The distinction that matters: "held by …" means the lock timeout fired and Postgres was
    // asked who had it. Prisma's expiry message means the transaction died first and the question
    // was never asked — which is what happened for two sprints.
    await expect(resetDb()).rejects.toThrow(/held by|lock timeout/i);
    await expect(resetDb()).rejects.not.toThrow(/expired transaction/);
  });
});

describe('the two budgets', () => {
  it('gives the transaction far longer than the lock it waits for', () => {
    // An assertion about configuration rather than behaviour, and deliberately so: the failure it
    // guards against needs a saturated machine to reproduce, which no test can arrange. What can
    // be stated is the relationship that was wrong — the two were equal, so a truncate that merely
    // took longer than five seconds died at the commit and rolled back, and the reset silently did
    // not happen. Anything close to equal is the same bug again.
    expect(TRUNCATE_TRANSACTION_TIMEOUT_MS).toBeGreaterThan(TRUNCATE_LOCK_TIMEOUT_MS * 2);
  });

  it('still fits inside the hook timeout', () => {
    // 20_000 in `vitest.config.ts`. Longer than that and vitest reports the hook rather than the
    // database, which is the diagnostics going quiet by a different route.
    expect(TRUNCATE_TRANSACTION_TIMEOUT_MS).toBeLessThan(20_000);
  });
});

describe('when nothing is in the way', () => {
  it('empties the database', async () => {
    await resetDb();

    const rows = await testDb().$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count FROM account
    `;

    expect(Number(rows[0]?.count ?? -1)).toBe(0);
  });
});
