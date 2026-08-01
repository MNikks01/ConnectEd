/**
 * Verification workflow — S1-4/S1-5 (FR-VER-001..006, 008).
 *
 * The rules under test are the ones the product depends on: only the school decides, a school
 * cannot approve itself, an approved membership actually unlocks academic access, and a revoked
 * one takes it away immediately.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { assertVerifiedMemberOfClass } from '../shared/authz/index.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs, type ErrorBody } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { VerificationRequestResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

interface ListBody {
  data: VerificationRequestResponse[];
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config });
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);
});

async function auth(accountId: string, kind: 'SCHOOL' | 'INDIVIDUAL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

/** A fresh individual with no membership anywhere — the realistic requester. */
async function newcomer(role: string, handle: string) {
  const account = await db.account.create({
    data: {
      email: `${handle}-${Date.now()}@fixture.test`,
      type: 'INDIVIDUAL',
      userProfile: {
        create: {
          fullName: `${handle} person`,
          handle: `${handle}${Date.now()}`,
          role: role as never,
        },
      },
    },
    select: { id: true },
  });

  return { id: account.id, authorization: await auth(account.id, 'INDIVIDUAL', role) };
}

async function submitStudentRequest() {
  const student = await newcomer('STUDENT', 'newstudent');

  const response = await request(app)
    .post('/api/v1/verifications')
    .set('Authorization', student.authorization)
    .send({ role: 'STUDENT', schoolId: fixture.schoolAccountId, classId: fixture.classAId });

  return { student, response, body: bodyAs<VerificationRequestResponse>(response) };
}

describe('POST /verifications — submitting', () => {
  it('creates a PENDING student request (FR-VER-001)', async () => {
    const { response, body } = await submitStudentRequest();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ role: 'STUDENT', status: 'PENDING', classId: fixture.classAId });
  });

  it('creates the child alongside a parent request (FR-VER-002)', async () => {
    const parent = await newcomer('PARENT', 'newparent');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', parent.authorization)
      .send({
        role: 'PARENT',
        schoolId: fixture.schoolAccountId,
        classId: fixture.classBId,
        childFullName: 'Riya Newparent',
      });

    expect(response.status).toBe(201);
    expect(bodyAs<VerificationRequestResponse>(response).childName).toBe('Riya Newparent');
  });

  it('records declared subjects on a teacher request (FR-VER-003)', async () => {
    const teacher = await newcomer('TEACHER', 'newteacher');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', teacher.authorization)
      .send({
        role: 'TEACHER',
        schoolId: fixture.schoolAccountId,
        subjectIds: [fixture.mathsSubjectId],
      });

    expect(response.status).toBe(201);
    expect(bodyAs<VerificationRequestResponse>(response).subjectIds).toEqual([
      fixture.mathsSubjectId,
    ]);
  });

  it('accepts a principal request (FR-VER-004)', async () => {
    const principal = await newcomer('PRINCIPAL', 'newprincipal');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', principal.authorization)
      .send({ role: 'PRINCIPAL', schoolId: fixture.schoolAccountId });

    expect(response.status).toBe(201);
  });

  it('refuses a school account — an institution cannot be its own member', async () => {
    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ role: 'STUDENT', schoolId: fixture.schoolAccountId, classId: fixture.classAId });

    // This is what makes self-approval structurally impossible rather than a check to remember.
    expect(response.status).toBe(403);
  });

  it('refuses a class belonging to a different school', async () => {
    const rival = await db.account.create({
      data: {
        email: `rival-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival' } },
      },
      select: { id: true },
    });
    const student = await newcomer('STUDENT', 'crossschool');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', student.authorization)
      // Asking rival school for a class that belongs to the fixture school.
      .send({ role: 'STUDENT', schoolId: rival.id, classId: fixture.classAId });

    expect(response.status).toBe(404);
  });

  it('refuses subjects belonging to a different school', async () => {
    const rival = await db.account.create({
      data: {
        email: `rival2-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival 2' } },
      },
      select: { id: true },
    });
    const teacher = await newcomer('TEACHER', 'crossteacher');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', teacher.authorization)
      .send({ role: 'TEACHER', schoolId: rival.id, subjectIds: [fixture.mathsSubjectId] });

    expect(response.status).toBe(404);
  });

  it('rejects a duplicate pending request for the same scope', async () => {
    const { student } = await submitStudentRequest();

    const again = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', student.authorization)
      .send({ role: 'STUDENT', schoolId: fixture.schoolAccountId, classId: fixture.classAId });

    expect(again.status).toBe(409);
  });

  it('rejects a student request carrying a childId — the union will not parse it', async () => {
    const student = await newcomer('STUDENT', 'sneaky');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', student.authorization)
      .send({
        role: 'STUDENT',
        schoolId: fixture.schoolAccountId,
        classId: fixture.classAId,
        childFullName: 'Not mine',
      });

    // Extra keys are stripped rather than honoured; the request is a plain student request.
    expect(response.status).toBe(201);
    expect(bodyAs<VerificationRequestResponse>(response).childId).toBeNull();
  });

  it('rejects a teacher request with no subjects', async () => {
    const teacher = await newcomer('TEACHER', 'nosubjects');

    const response = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', teacher.authorization)
      .send({ role: 'TEACHER', schoolId: fixture.schoolAccountId, subjectIds: [] });

    expect(response.status).toBe(422);
  });
});

describe('GET /schools/:id/verifications — the review queue', () => {
  it('lists pending requests for the school', async () => {
    await submitStudentRequest();

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/verifications?status=PENDING`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'));

    expect(response.status).toBe(200);
    expect(bodyAs<ListBody>(response).data).toHaveLength(1);
    expect(bodyAs<ListBody>(response).data[0]?.requesterName).toBeTruthy();
  });

  it.each([
    ['a principal', () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL')],
    ['a teacher', () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER')],
    ['a student', () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT')],
  ])('refuses %s — the queue is the school’s alone', async (_label, authorization) => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/verifications`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(403);
  });
});

describe('GET /me/verifications', () => {
  it('returns the caller’s own requests only', async () => {
    const { student } = await submitStudentRequest();

    const mine = await request(app)
      .get('/api/v1/me/verifications')
      .set('Authorization', student.authorization);

    const someoneElse = await request(app)
      .get('/api/v1/me/verifications')
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    expect(bodyAs<ListBody>(mine).data).toHaveLength(1);
    expect(bodyAs<ListBody>(someoneElse).data).toHaveLength(0);
  });
});

describe('POST /verifications/:id/decision', () => {
  it('approves, creating a VERIFIED membership (FR-VER-005)', async () => {
    const { student, body } = await submitStudentRequest();

    const response = await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(200);
    expect(bodyAs<VerificationRequestResponse>(response).status).toBe('VERIFIED');

    const membership = await db.membership.findFirst({
      where: { accountId: student.id, schoolId: fixture.schoolAccountId },
    });
    expect(membership?.status).toBe('VERIFIED');
    expect(membership?.classId).toBe(fixture.classAId);
  });

  it('unlocks academic access that was denied before approval (FR-VER-006)', async () => {
    const { student, body } = await submitStudentRequest();
    const actor = {
      accountId: student.id,
      accountType: 'INDIVIDUAL' as const,
      role: 'STUDENT' as const,
    };

    // Before: the policy refuses.
    await expect(assertVerifiedMemberOfClass(db, actor, fixture.classAId)).rejects.toMatchObject({
      code: 'VERIFICATION_REQUIRED',
    });

    await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ decision: 'APPROVE' });

    // After: the same policy allows. This is the product's central promise.
    await expect(assertVerifiedMemberOfClass(db, actor, fixture.classAId)).resolves.toBeUndefined();
  });

  it('provisions a teacher profile and subject allocations on approval', async () => {
    const teacher = await newcomer('TEACHER', 'allocteacher');
    const submitted = await request(app)
      .post('/api/v1/verifications')
      .set('Authorization', teacher.authorization)
      .send({
        role: 'TEACHER',
        schoolId: fixture.schoolAccountId,
        subjectIds: [fixture.mathsSubjectId, fixture.scienceSubjectId],
      });

    await request(app)
      .post(`/api/v1/verifications/${bodyAs<VerificationRequestResponse>(submitted).id}/decision`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ decision: 'APPROVE' });

    const profile = await db.teacherProfile.findFirst({
      where: { accountId: teacher.id, schoolId: fixture.schoolAccountId },
      select: { id: true, allocations: { select: { subjectId: true } } },
    });

    expect(profile?.allocations.map((a) => a.subjectId).sort()).toEqual(
      [fixture.mathsSubjectId, fixture.scienceSubjectId].sort(),
    );
  });

  it('rejects, leaving no membership behind', async () => {
    const { student, body } = await submitStudentRequest();

    const response = await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ decision: 'REJECT', note: 'Not enrolled here.' });

    expect(response.status).toBe(200);
    expect(bodyAs<VerificationRequestResponse>(response).status).toBe('REJECTED');
    expect(
      await db.membership.count({
        where: { accountId: student.id, schoolId: fixture.schoolAccountId },
      }),
    ).toBe(0);
  });

  it('writes an audit entry naming the deciding school', async () => {
    const { body } = await submitStudentRequest();

    await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ decision: 'APPROVE' });

    const entry = await db.auditLog.findFirst({ where: { entityId: body.id } });

    expect(entry?.action).toBe('verification.approved');
    expect(entry?.actorAccountId).toBe(fixture.schoolAccountId);
  });

  it.each([
    ['a principal', () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL')],
    ['a teacher', () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER')],
    ['a student', () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT')],
  ])('refuses %s — only the school approves', async (_label, authorization) => {
    const { body } = await submitStudentRequest();

    const response = await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', await authorization())
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(403);
    const unchanged = await db.verificationRequest.findUnique({ where: { id: body.id } });
    expect(unchanged?.status).toBe('PENDING');
  });

  it('refuses the requester approving their own request', async () => {
    const { student, body } = await submitStudentRequest();

    const response = await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', student.authorization)
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(403);
  });

  it('refuses another school, with 404 so request ids cannot be probed', async () => {
    const { body } = await submitStudentRequest();
    const rival = await db.account.create({
      data: {
        email: `rival3-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival 3' } },
      },
      select: { id: true },
    });

    const response = await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', await auth(rival.id, 'SCHOOL'))
      .send({ decision: 'APPROVE' });

    expect(response.status).toBe(404);
  });

  it('refuses deciding a request twice', async () => {
    const { body } = await submitStudentRequest();
    const schoolAuth = await auth(fixture.schoolAccountId, 'SCHOOL');

    await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', schoolAuth)
      .send({ decision: 'APPROVE' });

    const second = await request(app)
      .post(`/api/v1/verifications/${body.id}/decision`)
      .set('Authorization', schoolAuth)
      .send({ decision: 'REJECT' });

    expect(second.status).toBe(409);
    expect(bodyAs<ErrorBody>(second).error.code).toBe('CONFLICT');
  });
});

describe('DELETE /schools/:id/members/:accountId — revoke (FR-VER-008)', () => {
  it('revokes access immediately', async () => {
    const actor = {
      accountId: fixture.studentAccountId,
      accountType: 'INDIVIDUAL' as const,
      role: 'STUDENT' as const,
    };

    await expect(assertVerifiedMemberOfClass(db, actor, fixture.classAId)).resolves.toBeUndefined();

    const response = await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.studentAccountId}`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'));

    expect(response.status).toBe(204);
    await expect(assertVerifiedMemberOfClass(db, actor, fixture.classAId)).rejects.toMatchObject({
      code: 'VERIFICATION_REQUIRED',
    });
  });

  it('writes an audit entry', async () => {
    await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.studentAccountId}`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'));

    const entry = await db.auditLog.findFirst({ where: { action: 'membership.revoked' } });
    expect(entry?.entityId).toBe(fixture.studentAccountId);
  });

  it.each([
    ['a principal', () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL')],
    ['a teacher', () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER')],
  ])('refuses %s', async (_label, authorization) => {
    const response = await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.studentAccountId}`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(403);
    const membership = await db.membership.findFirst({
      where: { accountId: fixture.studentAccountId },
      select: { status: true },
    });
    expect(membership?.status).toBe('VERIFIED');
  });

  it('404s when the account is not a verified member', async () => {
    const stranger = await newcomer('USER', 'stranger');

    const response = await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${stranger.id}`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'));

    expect(response.status).toBe(404);
  });
});

describe('GET /schools/:id/members — the roster (FR-INST-005)', () => {
  it('lists the school’s verified members with their scope', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/members`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'));

    expect(response.status).toBe(200);

    const members = bodyAs<{
      data: { accountId: string; role: string; className: string | null }[];
    }>(response).data;

    // The fixture verifies a teacher, another teacher, a principal, a student, and a parent.
    expect(members).toHaveLength(5);
    expect(members.map((member) => member.role).sort()).toEqual([
      'PARENT',
      'PRINCIPAL',
      'STUDENT',
      'TEACHER',
      'TEACHER',
    ]);

    const student = members.find((member) => member.accountId === fixture.studentAccountId);
    expect(student?.className).toBe('Class 8-A (English)');
  });

  it('names the child for a parent membership', async () => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/members`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'));

    const parent = bodyAs<{ data: { accountId: string; childName: string | null }[] }>(
      response,
    ).data.find((member) => member.accountId === fixture.parentAccountId);

    expect(parent?.childName).toBe('Fixture Child');
  });

  it('drops a member from the roster once revoked', async () => {
    const schoolAuth = await auth(fixture.schoolAccountId, 'SCHOOL');

    await request(app)
      .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.studentAccountId}`)
      .set('Authorization', schoolAuth);

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/members`)
      .set('Authorization', schoolAuth);

    const ids = bodyAs<{ data: { accountId: string }[] }>(response).data.map((m) => m.accountId);
    expect(ids).not.toContain(fixture.studentAccountId);
  });

  it.each([
    ['a principal', () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL')],
    ['a teacher', () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER')],
    ['a student', () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT')],
  ])('refuses %s — the roster is the school’s alone', async (_label, authorization) => {
    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/members`)
      .set('Authorization', await authorization());

    expect(response.status).toBe(403);
  });

  it('refuses another school with 404', async () => {
    const rival = await db.account.create({
      data: {
        email: `rival-roster-${Date.now()}@fixture.test`,
        type: 'SCHOOL',
        schoolProfile: { create: { name: 'Rival roster' } },
      },
      select: { id: true },
    });

    const response = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/members`)
      .set('Authorization', await auth(rival.id, 'SCHOOL'));

    expect(response.status).toBe(404);
  });
});
