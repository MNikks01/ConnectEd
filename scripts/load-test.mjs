/**
 * Latency and throughput, measured (S9-10, NFR-002 and NFR-003).
 *
 * `TRD/00-technical-requirements.md` has promised **p95 read < 300 ms, p95 write < 600 ms** and a
 * **500 RPS baseline** since Sprint 2. Nothing had ever produced a number. A requirement with no
 * measurement is a sentence, and this repository has spent a sprint finding out how many of those
 * it has.
 *
 * **Say the shape of the load or the number means nothing.** Two things are chosen here and both
 * change the answer:
 *
 * - *What* is being asked for. `/me/memberships` is the read every page performs before it does
 *   anything else — a small authorized query behind a token check. The class feed is the read that
 *   fans out. Together they bracket the ordinary case rather than flattering it with `/healthz`,
 *   which touches nothing and would report the framework's speed.
 * - *Who* is asking. Every request carries a real access token for a verified member, because an
 *   unauthenticated 401 is fast and proves nothing: the authorization this product is built around
 *   is precisely the work being measured.
 *
 * Writes are measured separately and deliberately at lower concurrency. A write here is a
 * transaction plus an outbox row, and hammering it measures Postgres's write path on whatever disk
 * happens to be underneath rather than anything about the product.
 *
 *   node scripts/load-test.mjs
 *   LOAD_API_URL=https://api.staging.example/api/v1 node scripts/load-test.mjs
 */
// Imported rather than assumed: the shared ESLint config declares no Node globals for `.mjs`.
import autocannon from 'autocannon';
import console from 'node:console';
import process from 'node:process';
// `fetch` is global in Node 18+, but "global at runtime" and "declared to the linter" are
// different things, and only one of them is checkable.
const { fetch } = globalThis;

const API = process.env.LOAD_API_URL ?? 'http://localhost:4000/api/v1';
const DURATION = Number(process.env.LOAD_DURATION ?? 10);
const READ_CONNECTIONS = Number(process.env.LOAD_CONNECTIONS ?? 50);

const PASSWORD = 'LoadTest-Passw0rd!';
const stamp = Date.now().toString(36);

async function api(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'web',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  }
  return response.status === 204 ? null : response.json();
}

/**
 * A school, a class, a verified teacher — built through the API rather than seeded, so the rows
 * are the shape production makes and the token is one the server really issued.
 */
async function fixture() {
  const school = await api('/auth/register/school', {
    method: 'POST',
    body: { email: `load-${stamp}@example.test`, password: PASSWORD, name: `Load ${stamp}` },
  });

  const me = await api('/me', { token: school.accessToken });
  const klass = await api(`/schools/${me.id}/classes`, {
    method: 'POST',
    token: school.accessToken,
    body: { medium: 'ENGLISH', level: 'CLASS_7', section: 'A' },
  });

  const teacher = await api('/auth/register', {
    method: 'POST',
    body: {
      email: `load-t-${stamp}@example.test`,
      password: PASSWORD,
      fullName: 'Load Teacher',
      handle: `loadt${stamp}`,
    },
  });

  const subject = await api(`/classes/${klass.id}/subjects`, {
    method: 'POST',
    token: school.accessToken,
    body: { name: 'Mathematics' },
  });

  const request = await api('/verifications', {
    method: 'POST',
    token: teacher.accessToken,
    body: { schoolId: me.id, role: 'TEACHER', subjectIds: [subject.id] },
  });

  await api(`/verifications/${request.id}/decision`, {
    method: 'POST',
    token: school.accessToken,
    body: { decision: 'APPROVE' },
  });

  return { schoolId: me.id, classId: klass.id, subjectId: subject.id, token: teacher.accessToken };
}

function run(title, options) {
  return new Promise((resolve, reject) => {
    autocannon({ url: API, duration: DURATION, ...options }, (error, result) =>
      error ? reject(error) : resolve({ title, result }),
    );
  });
}

const { classId, subjectId, token } = await fixture();
const headers = { Authorization: `Bearer ${token}`, 'X-Client-Type': 'web' };

console.log(`Target ${API}, ${DURATION}s per scenario\n`);

const scenarios = [
  await run('read: /me/memberships (every page does this first)', {
    connections: READ_CONNECTIONS,
    requests: [{ method: 'GET', path: '/api/v1/me/memberships', headers }],
  }),
  await run('read: a class feed (the read that fans out)', {
    connections: READ_CONNECTIONS,
    requests: [{ method: 'GET', path: `/api/v1/classes/${classId}/academics`, headers }],
  }),
  await run('write: publish an academic item (transaction + outbox row)', {
    // Lower on purpose — see the header. This measures the product's write path, not the disk's.
    connections: 10,
    requests: [
      {
        method: 'POST',
        path: `/api/v1/classes/${classId}/academics`,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'HOMEWORK',
          subjectId,
          title: 'Load test item',
          body: 'Written by scripts/load-test.mjs',
        }),
      },
    ],
  }),
];

const TARGETS = { read: 300, write: 600 };
let failed = false;

/**
 * **p97.5, not p95, and that is on purpose.** autocannon reports a fixed set of percentiles from
 * its histogram and p95 is not among them — p90 and p97.5 are. Interpolating between them would
 * be inventing a number, so the gate uses p97.5 and compares it against the p95 target. That is
 * strictly harder to pass than the requirement, which is the right direction to be wrong in.
 */
console.log(
  [
    'scenario'.padEnd(52),
    'rps'.padStart(8),
    'p50'.padStart(8),
    'p90'.padStart(8),
    'p97.5'.padStart(9),
    'p99'.padStart(8),
    'non2xx'.padStart(8),
  ].join(''),
);

for (const { title, result } of scenarios) {
  const kind = title.startsWith('write') ? 'write' : 'read';
  const tail = result.latency.p97_5;
  const bad = result.non2xx + result.errors;

  console.log(
    [
      title.padEnd(52),
      String(Math.round(result.requests.average)).padStart(8),
      `${result.latency.p50}ms`.padStart(8),
      `${result.latency.p90}ms`.padStart(8),
      `${tail}ms`.padStart(9),
      `${result.latency.p99}ms`.padStart(8),
      String(bad).padStart(8),
    ].join(''),
  );

  // A run where most requests were refused has a wonderful p95 and means nothing.
  if (bad > result.requests.total * 0.01) {
    console.error(`  ✗ ${bad} non-2xx or errored — the latency above is not about this product`);
    failed = true;
  } else if (tail > TARGETS[kind]) {
    console.error(`  ✗ p97.5 ${tail}ms exceeds the ${TARGETS[kind]}ms p95 target for a ${kind}`);
    failed = true;
  }
}

console.log(
  '\nNFR-002: p95 read < 300ms, p95 write < 600ms. NFR-003: 500 RPS baseline.\n' +
    'Where this ran and on what is the other half of the number — record it beside the result.',
);

process.exit(failed ? 1 : 0);
