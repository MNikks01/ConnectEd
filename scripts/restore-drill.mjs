/**
 * The restore drill (S9-7, NFR-014).
 *
 * `TRD/00-technical-requirements.md` promises **RTO ≤ 1h, RPO ≤ 15 min**, and
 * `Runbooks/db-restore.md` describes how to meet it. Neither had ever been run. A backup nobody has
 * restored is not a backup — it is a file, and the first time anyone finds out which is during an
 * incident.
 *
 * This takes a real backup of a real database, restores it into a scratch database beside it, and
 * compares the row count of **every table** in both. Then it prints how long that took, because
 * "≤ 1h" is a number and the only honest way to hold it is with another number.
 *
 * It runs `pg_dump` and `pg_restore` **inside a `postgres:16` container** rather than from the
 * host. That is not a convenience: a client older than the server refuses the dump outright, and
 * pinning the client to the image the server runs removes the most common way a restore fails at
 * the worst moment.
 *
 *   docker compose -f infrastructure/docker/compose.yml up -d
 *   node scripts/restore-drill.mjs
 *
 * Against something else:
 *
 *   DRILL_URL=postgresql://user:pass@host:5432/db DRILL_NETWORK=host node scripts/restore-drill.mjs
 */
// Imported rather than assumed, as `scripts/migrate-e2e.mjs` explains: the shared ESLint config
// declares no Node globals for `.mjs`, so a bare `process`, `console` or `URL` is an error. This
// tree is not currently in the lint task; being clean anyway costs three lines and removes a trap
// for whoever adds it.
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';

/** The compose stack's database, reached by its service name from inside the compose network. */
const URL_ = process.env.DRILL_URL ?? 'postgresql://connected:connected@postgres:5432/connected';
const NETWORK = process.env.DRILL_NETWORK ?? 'connected_default';
const IMAGE = process.env.DRILL_IMAGE ?? 'postgres:16';

const source = new URL(URL_);
const sourceDb = source.pathname.replace(/^\//, '');
const scratchDb = `${sourceDb}_drill`;
/** Everything but the database name — `createdb`/`pg_restore` need a database to connect *to*. */
const adminUrl = `${URL_.slice(0, URL_.lastIndexOf('/'))}/postgres`;

/**
 * Every table's exact row count in one query.
 *
 * `reltuples` would be faster and is an estimate, and an estimate cannot answer "did everything
 * arrive". `query_to_xml` runs a real `count(*)` per table without a round trip each.
 */
const COUNTS_SQL = `
  SELECT table_name,
         (xpath('/row/c/text()',
                query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name),
                             false, true, '')))[1]::text::bigint AS rows
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
`;

function inContainer(script, { capture = false } = {}) {
  return execFileSync(
    'docker',
    ['run', '--rm', '--network', NETWORK, '-e', 'PGCONNECT_TIMEOUT=10', IMAGE, 'sh', '-c', script],
    { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' },
  );
}

function counts(url) {
  const raw = inContainer(`psql '${url}' -At -F '|' -c "${COUNTS_SQL.replace(/\n\s*/g, ' ')}"`, {
    capture: true,
  });

  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('|'))
    .reduce((all, [table, rows]) => ({ ...all, [table]: Number(rows) }), {});
}

console.log(`Drilling ${sourceDb} → ${scratchDb} via ${IMAGE} on network ${NETWORK}\n`);

const before = counts(URL_);
const total = Object.values(before).reduce((sum, n) => sum + n, 0);

if (total === 0) {
  // A drill against an empty database is a drill that passes for the wrong reason.
  console.error(
    'The source database has no rows. Restoring nothing proves nothing — seed it, or run the\n' +
      'smoke test against the stack first, then drill.',
  );
  process.exit(1);
}

console.log(`${Object.keys(before).length} tables, ${total} rows to restore.\n`);

const started = Date.now();

// One container for the whole cycle, because the dump has to survive between the two halves and a
// volume shared with the host would measure the host's disk rather than the restore.
inContainer(
  [
    `pg_dump -Fc -f /tmp/drill.dump '${URL_}'`,
    `echo "dump: $(du -h /tmp/drill.dump | cut -f1)"`,
    `psql '${adminUrl}' -q -c 'DROP DATABASE IF EXISTS ${scratchDb}'`,
    `psql '${adminUrl}' -q -c 'CREATE DATABASE ${scratchDb}'`,
    // `--no-owner`: a restore into a different environment rarely has the same roles, and a drill
    // that only works where the roles already match is not a drill for the case that matters.
    `pg_restore --no-owner --exit-on-error -d '${adminUrl.replace('/postgres', `/${scratchDb}`)}' /tmp/drill.dump`,
  ].join(' && '),
);

const elapsed = (Date.now() - started) / 1000;

const after = counts(`${URL_.slice(0, URL_.lastIndexOf('/'))}/${scratchDb}`);

const missing = Object.entries(before).filter(([table, rows]) => after[table] !== rows);

// The scratch database goes whatever the outcome: a drill that leaves a copy of production data
// lying around beside production is a worse problem than the one it was checking for.
inContainer(`psql '${adminUrl}' -q -c 'DROP DATABASE IF EXISTS ${scratchDb}'`);

if (missing.length > 0) {
  console.error('\nThe restore did not match the source:\n');
  for (const [table, rows] of missing) {
    console.error(`  ${table}: ${rows} in source, ${after[table] ?? 'table absent'} restored`);
  }
  process.exit(1);
}

console.log(
  `\n✓ ${Object.keys(before).length} tables, ${total} rows, restored and verified in ${elapsed.toFixed(1)}s.`,
);
console.log(
  'That is the restore half of RTO. It does not include noticing, deciding, provisioning or\n' +
    'repointing the app — see Runbooks/db-restore.md, which now says so.',
);
