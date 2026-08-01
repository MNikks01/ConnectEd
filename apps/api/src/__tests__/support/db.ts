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
import { membershipScopeKey } from '../../shared/db/membership-scope.js';

import type { Db } from '../../shared/db/index.js';
import type { UserRole } from '../../generated/prisma/client.js';

let client: PrismaClient | undefined;

export function testDb(): Db {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL must be set for integration tests.');
  }

  client ??= new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  return client;
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
 */
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
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`);
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
    });
  } catch (error) {
    throw new Error(`resetDb could not truncate: ${await describeBlockers(error)}`);
  }
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
