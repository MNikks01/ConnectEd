/**
 * What the database looked like when a test failed — S6-11.
 *
 * The long-running flake (S5-12) has cost several reruns and produced no evidence, because a
 * rerun is the natural reaction and a rerun destroys the only state worth reading. Twice now the
 * failure has been observed, reproduced nothing, and left nothing behind.
 *
 * So this runs on failure, before anything else can happen: who else is connected, what they are
 * doing, and whether the rows the test needed are actually there. It prints and never throws — a
 * forensic that can fail the suite is a second bug wearing the first one's clothes.
 *
 * It is registered globally in `vitest.config.ts` and does nothing at all for test files that
 * never touched the database.
 */
import { afterEach } from 'vitest';

import { isDbInUse, testDb } from './db.js';

interface Backend {
  pid: number;
  application_name: string;
  state: string | null;
  state_change: Date | null;
  query: string;
}

interface Counts {
  accounts: bigint;
  memberships: bigint;
  plans: bigint;
}

async function report(name: string): Promise<void> {
  const db = testDb();

  const [backends, counts] = await Promise.all([
    db.$queryRaw<Backend[]>`
      SELECT pid, application_name, state, state_change, left(query, 160) AS query
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      ORDER BY state_change DESC NULLS LAST
    `,
    db.$queryRaw<Counts[]>`
      SELECT
        (SELECT count(*) FROM account)    AS accounts,
        (SELECT count(*) FROM membership) AS memberships,
        (SELECT count(*) FROM plan)       AS plans
    `,
  ]);

  const row = counts[0];

  console.error(
    [
      '',
      `── database forensics for a failed test ─────────────────────────────`,
      `  test:   ${name}`,
      `  pid:    ${String(process.pid)}`,
      // An empty database where the fixture should be is the signature of a truncate landing at
      // the wrong moment. A populated one points somewhere else entirely, which is just as useful.
      `  rows:   accounts=${String(row?.accounts ?? '?')} ` +
        `memberships=${String(row?.memberships ?? '?')} plans=${String(row?.plans ?? '?')}`,
      `  other connections (${String(backends.length)}):`,
      ...backends.map(
        (backend) =>
          `    pid ${String(backend.pid)} [${backend.application_name || 'unnamed'}] ` +
          `${backend.state ?? 'unknown'} @ ${backend.state_change?.toISOString() ?? '?'}` +
          `\n      ${backend.query.replace(/\s+/g, ' ').trim()}`,
      ),
      `─────────────────────────────────────────────────────────────────────`,
      '',
    ].join('\n'),
  );
}

afterEach(async (context) => {
  if (context.task.result?.state !== 'fail') return;
  // A file that never opened a connection has nothing to say, and opening one here would create
  // the very contention this is trying to observe.
  if (!isDbInUse()) return;

  try {
    await report(context.task.name);
  } catch (error) {
    // Never mask the real failure. If the forensics themselves cannot reach the database, that is
    // worth one line and nothing more.
    console.error(`  (forensics unavailable: ${String(error)})`);
  }
});
