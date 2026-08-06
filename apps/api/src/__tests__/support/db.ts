/**
 * Integration-test database helpers.
 *
 * These tests run against a **real Postgres**, not a mock. Authorization is the thing this repo
 * exists to get right, and a mocked repository would happily confirm whatever the test author
 * assumed — including a policy that never actually queries the data it claims to check.
 *
 * Requires `DATABASE_URL` (vitest sets it to `connected_test`) with migrations applied:
 *   pnpm --filter @connected/api db:deploy
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { createBillingRepository } from '../../modules/billing/billing.repository.js';
import { TRIAL_PLAN_CODE } from '../../modules/billing/plan-catalogue.js';
import { membershipScopeKey } from '../../shared/db/membership-scope.js';

import type { Db } from '../../shared/db/index.js';
import type { UserRole } from '../../generated/prisma/client.js';

let client: PrismaClient | undefined;

/**
 * Stamped on every connection this suite opens, so `pg_stat_activity` can tell one test run from
 * another. The pid makes it unique per process; the prefix makes it recognisable.
 */
const APPLICATION_NAME = `connected-vitest-${String(process.pid)}`;

/**
 * What this suite is allowed to point at.
 *
 * `vitest.config.ts` reads `process.env.DATABASE_URL ?? <connected_test>`, and so does
 * `playwright.config.ts` with its own default. One exported variable therefore collapses three
 * databases into one — and since every case here begins by TRUNCATEing every table, the database
 * that gets collapsed onto is emptied. `connected` is a developer's own data.
 *
 * Nothing has been lost to this. The point is that nothing could survive it if it happened, and it
 * takes one `export` in one shell to happen. A name check costs nothing and makes the mistake
 * unable to run at all.
 */
const TEST_DATABASE = /_test$/;

function assertTruncatable(url: URL): void {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));

  if (!TEST_DATABASE.test(name)) {
    throw new Error(
      `Refusing to run integration tests against "${name}". Every case here TRUNCATEs every ` +
        `table, so this suite may only point at a database whose name ends in "_test" — ` +
        `"connected_test" by default. DATABASE_URL is currently set to something else, which is ` +
        `usually an \`export\` left over in the shell.`,
    );
  }
}

export function testDb(): Db {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL must be set for integration tests.');
  }

  const url = new URL(connectionString);
  assertTruncatable(url);
  url.searchParams.set('application_name', APPLICATION_NAME);

  client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  return client;
}

/** Whether this file ever opened a connection. Read by the failure forensics, which must not. */
export function isDbInUse(): boolean {
  return client !== undefined;
}

export async function closeTestDb(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}

/**
 * Empties every table between tests. TRUNCATE ... CASCADE in one statement is both faster than
 * per-table deletes and immune to FK ordering.
 *
 * **The lock timeout is the important part.** TRUNCATE needs ACCESS EXCLUSIVE on every table, so a
 * single connection left idle inside a transaction blocks it — silently, until the twenty-second
 * test timeout fires. That has been the shape of a rare full-suite failure: a case times out here,
 * or worse, the reset lands late and the *next* test finds its fixture missing and reports a
 * puzzling 404 from a URL built out of an id that was never created.
 *
 * Five seconds is far longer than the truncate needs and far shorter than the test timeout, so the
 * suite now fails with a sentence naming the blocker instead of a symptom several steps away.
 *
 * **And for a while it could not — S6-13.** Prisma's own interactive-transaction timeout defaults
 * to 5000 ms, the same five seconds as the lock timeout below. Whichever expired first, the error
 * that surfaced was Prisma's: *"A commit cannot be executed on an expired transaction"*, naming a
 * commit nobody was waiting on, and by the time the blocker query ran the blocker had finished, so
 * the diagnostics reported "no other active connection found". The one message written for exactly
 * this case was the one message it could never print.
 *
 * The transaction is now given far longer than the lock it is waiting for, so the lock timeout is
 * what fires and the failure names what held it. Wide enough, too, that a truncate merely *slow*
 * because the machine is busy — an end-to-end run against another database on the same Postgres
 * will do it — finishes rather than failing a test about something else entirely. Still inside the
 * 20s hook timeout, so a genuine deadlock is caught here rather than by vitest.
 */
export const TRUNCATE_LOCK_TIMEOUT_MS = 5_000;
export const TRUNCATE_TRANSACTION_TIMEOUT_MS = 15_000;
export async function resetDb(): Promise<void> {
  const db = testDb();

  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) {
    throw new Error('No tables found — run `pnpm --filter @connected/api db:deploy` first.');
  }

  const list = tables.map((row) => `"public"."${row.tablename}"`).join(', ');

  try {
    // One transaction so `SET LOCAL` and the TRUNCATE are guaranteed the same connection; with a
    // pool, two separate statements need not be.
    await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = ${String(TRUNCATE_LOCK_TIMEOUT_MS)}`);
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
      },
      // Longer than the lock timeout on purpose — see the note above. Equal timeouts race, and
      // Prisma's wins with a message about the wrong thing.
      { timeout: TRUNCATE_TRANSACTION_TIMEOUT_MS, maxWait: TRUNCATE_TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    throw new Error(`resetDb could not truncate: ${await describeBlockers(error)}`);
  }

  // The plan catalogue is reference data, not fixture: registering a school connects a plan by
  // code, so a truncated `plan` table would fail every registration test with an error about a
  // missing record rather than about billing. Reapplying it from the same definition the app uses
  // keeps the two from drifting.
  await createBillingRepository(db).ensureCatalogue();
}

/** Names whatever is holding the locks, so the failure explains itself. */
async function describeBlockers(error: unknown): Promise<string> {
  const original = error instanceof Error ? error.message.split('\n')[0] : String(error);

  try {
    const blockers = await testDb().$queryRaw<{ state: string; query: string }[]>`
      SELECT state, query FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state <> 'idle'
    `;

    if (blockers.length === 0) return `${original} (no other active connection found)`;

    const held = blockers.map((row) => `${row.state}: ${row.query.slice(0, 120)}`).join(' | ');
    return `${original} — held by ${held}`;
  } catch {
    return original ?? 'unknown error';
  }
}

/** Verifies the database is reachable, so a connection problem reads as one. */
export async function assertDbReachable(): Promise<void> {
  try {
    await testDb().$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(
      `Integration tests need Postgres at DATABASE_URL. Start it with ` +
        `\`docker compose up -d postgres\` and apply migrations with ` +
        `\`pnpm --filter @connected/api db:deploy\`. Original error: ${String(error)}`,
    );
  }

  await assertSoleTestRun();
}

/**
 * Refuses to run when a second test process is already on this database — S5-12.
 *
 * This suite TRUNCATEs every table between cases. Two runs sharing one database therefore delete
 * each other's fixtures at random, and the result is not an error but a *wrong answer*: a row that
 * was created moments ago is absent, an account that exists is not found, a seeded membership
 * vanishes between `beforeEach` and the assertion.
 *
 * That is precisely the shape of the long-standing local flake — "roughly one run in four", never
 * once in CI, on a developer machine where the vitest config already notes that dev servers, E2E
 * servers and Docker all run alongside. CI runs one job against a private database and cannot
 * reproduce it, which fits exactly.
 *
 * **This does not prove that was the cause**, and it is not a fix for anything else. It removes
 * one specific way to lose an afternoon, and makes it say so in a sentence instead of surfacing as
 * a puzzling 404 several steps away.
 */
async function assertSoleTestRun(): Promise<void> {
  const others = await testDb().$queryRaw<{ application_name: string; pid: number }[]>`
    SELECT DISTINCT application_name, pid FROM pg_stat_activity
    WHERE datname = current_database()
      AND application_name LIKE 'connected-vitest-%'
      AND application_name <> ${APPLICATION_NAME}
  `;

  if (others.length > 0) {
    const names = [...new Set(others.map((row) => row.application_name))].join(', ');

    throw new Error(
      `Another test run is already using this database (${names}). These suites TRUNCATE between ` +
        `cases, so two runs delete each other's fixtures and fail in ways that look like ` +
        `application bugs. Wait for the other run, or point DATABASE_URL at a different database.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Fixtures — a miniature school, built explicitly so each test can see its shape.
// ---------------------------------------------------------------------------

export interface SchoolFixture {
  schoolAccountId: string;
  classAId: string;
  classBId: string;
  mathsSubjectId: string;
  scienceSubjectId: string;
  teacherAccountId: string;
  teacherProfileId: string;
  otherTeacherAccountId: string;
  otherTeacherProfileId: string;
  principalAccountId: string;
  studentAccountId: string;
  parentAccountId: string;
  childId: string;
  outsiderAccountId: string;
  /** ConnectEd staff (ADR-0017). A member of nothing, and that is the point. */
  platformAdminAccountId: string;
}

let sequence = 0;
function uniqueEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}@fixture.test`;
}

async function createIndividual(db: Db, role: UserRole, handlePrefix: string): Promise<string> {
  sequence += 1;
  const account = await db.account.create({
    data: {
      email: uniqueEmail(handlePrefix),
      type: 'INDIVIDUAL',
      userProfile: {
        create: { fullName: `${handlePrefix} fixture`, handle: `${handlePrefix}${sequence}`, role },
      },
    },
    select: { id: true },
  });
  return account.id;
}

/**
 * Builds: one school, two classes, two subjects in class A, a teacher allocated to Maths in class
 * A and class teacher of A, a second teacher allocated to nothing, a principal, a verified student
 * in A, a parent with a verified child in B, and an unaffiliated outsider.
 */
export async function seedSchool(db: Db): Promise<SchoolFixture> {
  const schoolAccount = await db.account.create({
    data: {
      email: uniqueEmail('school'),
      type: 'SCHOOL',
      schoolProfile: { create: { name: 'Fixture School' } },
    },
    select: { id: true },
  });
  const schoolId = schoolAccount.id;

  // Every school registered through the API gets a trial in the same statement (FR-BILL-001), so
  // a fixture school without one would be a shape production never produces. Tests that want the
  // no-subscription path delete this row explicitly.
  await db.subscription.create({
    data: {
      school: { connect: { accountId: schoolId } },
      status: 'TRIALING',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      plan: { connect: { code: TRIAL_PLAN_CODE } },
    },
  });

  const classA = await db.class.create({
    data: { schoolId, medium: 'ENGLISH', level: 'CLASS_8', section: 'A' },
    select: { id: true },
  });
  const classB = await db.class.create({
    data: { schoolId, medium: 'ENGLISH', level: 'CLASS_8', section: 'B' },
    select: { id: true },
  });

  const maths = await db.subject.create({
    data: { classId: classA.id, name: 'Mathematics' },
    select: { id: true },
  });
  const science = await db.subject.create({
    data: { classId: classA.id, name: 'Science' },
    select: { id: true },
  });

  const teacherAccountId = await createIndividual(db, 'TEACHER', 'teacher');
  const otherTeacherAccountId = await createIndividual(db, 'TEACHER', 'otherteacher');
  const principalAccountId = await createIndividual(db, 'PRINCIPAL', 'principal');
  const studentAccountId = await createIndividual(db, 'STUDENT', 'student');
  const parentAccountId = await createIndividual(db, 'PARENT', 'parent');
  const outsiderAccountId = await createIndividual(db, 'USER', 'outsider');

  // Staff, deliberately with no membership anywhere: a platform admin who happened to be a member
  // of the fixture school would let a test pass for the wrong reason.
  const platformAdminAccountId = await createIndividual(db, 'USER', 'staff');
  await db.account.update({
    where: { id: platformAdminAccountId },
    data: { isPlatformAdmin: true },
  });

  const teacherProfile = await db.teacherProfile.create({
    data: { accountId: teacherAccountId, schoolId },
    select: { id: true },
  });
  const otherTeacherProfile = await db.teacherProfile.create({
    data: { accountId: otherTeacherAccountId, schoolId },
    select: { id: true },
  });

  await db.subjectAllocation.create({
    data: { teacherId: teacherProfile.id, subjectId: maths.id },
  });
  // One subject each, so "a teacher may publish" and "a teacher may not publish to someone else's
  // subject" are both expressible: the other teacher owns Science and is still refused Mathematics.
  await db.subjectAllocation.create({
    data: { teacherId: otherTeacherProfile.id, subjectId: science.id },
  });
  await db.classTeacher.create({
    data: { classId: classA.id, teacherId: teacherProfile.id },
  });

  const child = await db.child.create({
    data: {
      parentAccountId,
      fullName: 'Fixture Child',
      schoolId,
      classId: classB.id,
    },
    select: { id: true },
  });

  const memberships: {
    accountId: string;
    role: UserRole;
    classId: string | null;
    childId: string | null;
  }[] = [
    { accountId: teacherAccountId, role: 'TEACHER', classId: null, childId: null },
    { accountId: otherTeacherAccountId, role: 'TEACHER', classId: null, childId: null },
    { accountId: principalAccountId, role: 'PRINCIPAL', classId: null, childId: null },
    { accountId: studentAccountId, role: 'STUDENT', classId: classA.id, childId: null },
    { accountId: parentAccountId, role: 'PARENT', classId: classB.id, childId: child.id },
  ];

  for (const membership of memberships) {
    await db.membership.create({
      data: {
        accountId: membership.accountId,
        schoolId,
        role: membership.role,
        classId: membership.classId,
        childId: membership.childId,
        scopeKey: membershipScopeKey(membership.classId, membership.childId),
        status: 'VERIFIED',
      },
    });
  }

  /**
   * Proves the fixture is actually in the database before any test uses it.
   *
   * A rare failure mode has produced authorization tests failing as though a member were not a
   * member — which is what a fixture that was seeded and then lost looks like from inside a test.
   * Checking here names the step instead: if this throws, the seed did not survive, and the test
   * that would otherwise have failed was never the problem.
   */
  const seeded = await db.membership.count({ where: { schoolId } });

  if (seeded !== memberships.length) {
    throw new Error(
      `seedSchool: expected ${memberships.length} memberships after seeding, found ${seeded}. ` +
        'The fixture did not survive — suspect the reset, not the test that follows.',
    );
  }

  return {
    schoolAccountId: schoolId,
    classAId: classA.id,
    classBId: classB.id,
    mathsSubjectId: maths.id,
    scienceSubjectId: science.id,
    teacherAccountId,
    teacherProfileId: teacherProfile.id,
    otherTeacherAccountId,
    otherTeacherProfileId: otherTeacherProfile.id,
    principalAccountId,
    studentAccountId,
    parentAccountId,
    childId: child.id,
    outsiderAccountId,
    platformAdminAccountId,
  };
}

/** Flips a membership to a non-verified state, for the "verified" half of the policy tests. */
export async function setMembershipStatus(
  db: Db,
  accountId: string,
  status: 'PENDING' | 'REJECTED' | 'REVOKED',
): Promise<void> {
  await db.membership.updateMany({ where: { accountId }, data: { status } });
}
