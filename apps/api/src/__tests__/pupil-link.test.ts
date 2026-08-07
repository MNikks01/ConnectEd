/**
 * Linking a parent's child record to the pupil's own account — S7-6, FR-GRADE-005.
 *
 * Until the gradebook the product held two unconnected representations of a pupil: a `Child` row
 * owned by a parent, and a student `Account` with a verified STUDENT membership. Nothing needed
 * them joined, because homework fans out to class *members* and read tracking is per account. A
 * mark is the first thing that is *about* a pupil, so a parent could not otherwise find their
 * child's.
 *
 * This link is therefore an authorization edge, not bookkeeping: it decides which marks a parent
 * may read, and a wrong one shows a family another child's results. The negative cases below are
 * the feature.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

async function auth(accountId: string, kind: 'INDIVIDUAL' | 'SCHOOL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL', 'SCHOOL');

/** The child lives in class B; the fixture's student is verified in class A. */
async function studentInChildsClass(): Promise<string> {
  const child = await db.child.findUniqueOrThrow({
    where: { id: fixture.childId },
    select: { classId: true },
  });

  const account = await db.account.create({
    data: {
      email: `pupil-${Date.now()}@fixture.test`,
      type: 'INDIVIDUAL',
      userProfile: {
        create: { fullName: 'Ananya', handle: `ananya${Date.now()}`, role: 'STUDENT' },
      },
    },
    select: { id: true },
  });

  const { membershipScopeKey } = await import('../shared/db/membership-scope.js');
  await db.membership.create({
    data: {
      accountId: account.id,
      schoolId: fixture.schoolAccountId,
      role: 'STUDENT',
      classId: child.classId,
      status: 'VERIFIED',
      scopeKey: membershipScopeKey(child.classId, null),
    },
  });

  return account.id;
}

function link(childId: string, body: object) {
  return request(app)
    .put(`/api/v1/schools/${fixture.schoolAccountId}/children/${childId}/student`)
    .send(body);
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ config, logger, db });
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

afterAll(async () => {
  await closeTestDb();
});

describe('the school links a child to a pupil', () => {
  it('records the link', async () => {
    const pupil = await studentInChildsClass();

    const response = await link(fixture.childId, { studentAccountId: pupil }).set(
      'Authorization',
      await asSchool(),
    );

    expect(response.status).toBe(204);

    const child = await db.child.findUniqueOrThrow({ where: { id: fixture.childId } });
    expect(child.studentAccountId).toBe(pupil);
  });

  it('audits it, because it decides what a parent may read', async () => {
    const pupil = await studentInChildsClass();

    await link(fixture.childId, { studentAccountId: pupil }).set('Authorization', await asSchool());

    const entry = await db.auditLog.findFirstOrThrow({
      where: { entity: 'child', entityId: fixture.childId },
    });

    expect(entry.action).toBe('child.linked_to_student');
    expect(entry.actorAccountId).toBe(fixture.schoolAccountId);
    expect((entry.metadata as { studentAccountId: string }).studentAccountId).toBe(pupil);
  });

  it('carries the previous value when a wrong link is corrected', async () => {
    const first = await studentInChildsClass();
    const second = await studentInChildsClass();

    await link(fixture.childId, { studentAccountId: first }).set('Authorization', await asSchool());
    await link(fixture.childId, { studentAccountId: second }).set(
      'Authorization',
      await asSchool(),
    );

    const entries = await db.auditLog.findMany({
      where: { entity: 'child', entityId: fixture.childId },
      orderBy: { createdAt: 'desc' },
    });

    expect(
      (entries[0]?.metadata as { previousStudentAccountId?: string }).previousStudentAccountId,
    ).toBe(first);
  });

  it('unlinks with null, and says so in the trail', async () => {
    const pupil = await studentInChildsClass();
    await link(fixture.childId, { studentAccountId: pupil }).set('Authorization', await asSchool());

    const response = await link(fixture.childId, { studentAccountId: null }).set(
      'Authorization',
      await asSchool(),
    );

    expect(response.status).toBe(204);
    const child = await db.child.findUniqueOrThrow({ where: { id: fixture.childId } });
    expect(child.studentAccountId).toBeNull();

    const entry = await db.auditLog.findFirstOrThrow({
      where: { entity: 'child', entityId: fixture.childId },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.action).toBe('child.unlinked_from_student');
  });

  it('lets two parents of one pupil each link their own record', async () => {
    // The reason `student_account_id` is not unique. A constraint there would let the first parent
    // link and refuse the second forever, which is most families.
    const pupil = await studentInChildsClass();
    const child = await db.child.findUniqueOrThrow({ where: { id: fixture.childId } });

    const otherParent = await db.account.create({
      data: {
        email: `otherparent-${Date.now()}@fixture.test`,
        type: 'INDIVIDUAL',
        userProfile: { create: { fullName: 'P2', handle: `p2${Date.now()}`, role: 'PARENT' } },
      },
      select: { id: true },
    });
    const secondRecord = await db.child.create({
      data: {
        parentAccountId: otherParent.id,
        fullName: 'Ananya Sharma',
        schoolId: fixture.schoolAccountId,
        classId: child.classId,
      },
      select: { id: true },
    });

    for (const id of [fixture.childId, secondRecord.id]) {
      const response = await link(id, { studentAccountId: pupil }).set(
        'Authorization',
        await asSchool(),
      );
      expect(response.status).toBe(204);
    }
  });
});

describe('what the school may not link', () => {
  it('refuses an account that is not a verified student of the child’s class', async () => {
    // The fixture's student is verified in class A; the child is in class B. Without this check a
    // school could point a child at any account in the product and hand its parent those marks.
    const response = await link(fixture.childId, {
      studentAccountId: fixture.studentAccountId,
    }).set('Authorization', await asSchool());

    expect(response.status).toBe(404);
  });

  it('refuses a teacher’s account', async () => {
    const response = await link(fixture.childId, {
      studentAccountId: fixture.teacherAccountId,
    }).set('Authorization', await asSchool());

    expect(response.status).toBe(404);
  });

  it('refuses a child belonging to another school', async () => {
    const other = await seedSchool(db);

    const response = await request(app)
      .put(`/api/v1/schools/${fixture.schoolAccountId}/children/${other.childId}/student`)
      .send({ studentAccountId: null })
      .set('Authorization', await asSchool());

    expect(response.status).toBe(404);
  });

  it('rejects a malformed body rather than guessing', async () => {
    const response = await link(fixture.childId, {}).set('Authorization', await asSchool());

    // 422, not 400: this API distinguishes "unparseable" from "parsed and invalid"
    // (`.docs/API/02-error-model.md`). A missing key is the second kind.
    expect(response.status).toBe(422);
  });
});

describe('who may link — nobody but the school', () => {
  const actors: [string, () => Promise<string>][] = [
    ['a student', () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT')],
    ['the parent themselves', () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT')],
    ['a teacher', () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER')],
    ['a principal', () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL')],
    ['an outsider', () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER')],
    ['platform staff', () => auth(fixture.platformAdminAccountId, 'INDIVIDUAL', 'USER')],
  ];

  it.each(actors)('refuses %s', async (_name, actor) => {
    const pupil = await studentInChildsClass();

    const response = await link(fixture.childId, { studentAccountId: pupil }).set(
      'Authorization',
      await actor(),
    );

    expect(response.status).toBe(403);

    const child = await db.child.findUniqueOrThrow({ where: { id: fixture.childId } });
    expect(child.studentAccountId).toBeNull();
  });

  it('refuses another school', async () => {
    const other = await seedSchool(db);
    const pupil = await studentInChildsClass();

    const response = await link(fixture.childId, { studentAccountId: pupil }).set(
      'Authorization',
      await auth(other.schoolAccountId, 'SCHOOL', 'SCHOOL'),
    );

    // 404 and not 403, deliberately: a school asking about another school's data is out of scope
    // rather than forbidden, and 403 would confirm that the other school exists. `assertIsSchool`
    // says so in as many words — this expectation is the convention, not an oversight.
    expect(response.status).toBe(404);
  });

  it('refuses an unauthenticated caller', async () => {
    const response = await link(fixture.childId, { studentAccountId: null });

    expect(response.status).toBe(401);
  });
});
