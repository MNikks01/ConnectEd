/**
 * Permission-matrix suite — S1-7.
 *
 * `.docs/PRD/09-permissions-matrix.md` is the product contract; `.docs/Security/02-authorization.md`
 * requires the enforcement contract to match it "test-for-test". This file is that check: one table
 * of capabilities × roles, asserted against the live API.
 *
 * Two things make it worth more than the per-module tests it overlaps with:
 *
 * 1. **It is exhaustive by construction.** Every capability lists an outcome for *every* role, so a
 *    role cannot be quietly forgotten — omitting one is a missing table entry, not a missing file.
 * 2. **It reads like the document it enforces**, so a reviewer can compare the two side by side
 *    without holding an endpoint map in their head.
 *
 * `UNIMPLEMENTED` records the rows whose endpoints do not exist yet, so the gap between contract
 * and implementation is visible here rather than being silently absent.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

/** The matrix's columns. `classTeacher` is a teacher who also holds the class-teacher allocation. */
type MatrixRole =
  'student' | 'parent' | 'teacher' | 'classTeacher' | 'principal' | 'school' | 'generalUser';

const ALL_ROLES: MatrixRole[] = [
  'student',
  'parent',
  'teacher',
  'classTeacher',
  'principal',
  'school',
  'generalUser',
];

/** ✅ can do · ➖ must be refused. (👁 view-only rows land with the read endpoints in Phase 2.) */
type Outcome = 'allow' | 'deny';

interface Capability {
  /** The matrix row, quoted so the two documents can be diffed by eye. */
  name: string;
  outcomes: Record<MatrixRole, Outcome>;
  /** Performs the capability as the given role and returns the HTTP status. */
  attempt: (role: MatrixRole) => Promise<number>;
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

async function authFor(role: MatrixRole): Promise<string> {
  const map: Record<MatrixRole, { id: string; type: 'SCHOOL' | 'INDIVIDUAL'; role?: string }> = {
    student: { id: fixture.studentAccountId, type: 'INDIVIDUAL', role: 'STUDENT' },
    parent: { id: fixture.parentAccountId, type: 'INDIVIDUAL', role: 'PARENT' },
    // The fixture's second teacher holds no class-teacher allocation.
    teacher: { id: fixture.otherTeacherAccountId, type: 'INDIVIDUAL', role: 'TEACHER' },
    // The fixture's first teacher is class teacher of class A.
    classTeacher: { id: fixture.teacherAccountId, type: 'INDIVIDUAL', role: 'TEACHER' },
    principal: { id: fixture.principalAccountId, type: 'INDIVIDUAL', role: 'PRINCIPAL' },
    school: { id: fixture.schoolAccountId, type: 'SCHOOL' },
    generalUser: { id: fixture.outsiderAccountId, type: 'INDIVIDUAL', role: 'USER' },
  };

  const entry = map[role];
  const token = await tokens.signAccessToken({
    sub: entry.id,
    accountType: entry.type,
    ...(entry.role ? { role: entry.role as never } : {}),
  });

  return `Bearer ${token}`;
}

const CAPABILITIES: Capability[] = [
  {
    name: 'Create school & class structure',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post(`/api/v1/schools/${fixture.schoolAccountId}/classes`)
        .set('Authorization', await authFor(role))
        .send({ medium: 'HINDI', level: 'CLASS_3', section: 'D' });
      return response.status;
    },
  },
  {
    name: 'Define subjects of a class',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post(`/api/v1/classes/${fixture.classAId}/subjects`)
        .set('Authorization', await authFor(role))
        .send({ name: `Subject ${role}` });
      return response.status;
    },
  },
  {
    name: 'Update own school profile',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .patch(`/api/v1/schools/${fixture.schoolAccountId}`)
        .set('Authorization', await authFor(role))
        .send({ city: 'Nagpur' });
      return response.status;
    },
  },
  {
    name: 'Allocate class teacher',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post(`/api/v1/classes/${fixture.classBId}/class-teacher`)
        .set('Authorization', await authFor(role))
        .send({ teacherAccountId: fixture.otherTeacherAccountId });
      return response.status;
    },
  },
  {
    name: 'Review the verification queue',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .get(`/api/v1/schools/${fixture.schoolAccountId}/verifications`)
        .set('Authorization', await authFor(role));
      return response.status;
    },
  },
  {
    name: 'Verify / remove members',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .delete(`/api/v1/schools/${fixture.schoolAccountId}/members/${fixture.studentAccountId}`)
        .set('Authorization', await authFor(role));
      return response.status;
    },
  },
  {
    name: 'Submit verification request',
    outcomes: {
      student: 'allow',
      parent: 'allow',
      teacher: 'allow',
      classTeacher: 'allow',
      principal: 'allow',
      // "An institution cannot be its own member" — this is what makes self-approval impossible.
      school: 'deny',
      // See the note below on the matrix's General User row.
      generalUser: 'allow',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post('/api/v1/verifications')
        .set('Authorization', await authFor(role))
        // A second school, so nobody in the fixture already holds this scope.
        .send({ role: 'PRINCIPAL', schoolId: await secondSchoolId() });
      return response.status;
    },
  },
  {
    name: 'Publish homework/assignments/projects',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'allow',
      classTeacher: 'allow',
      // 👁 in the matrix: a principal views academics, publishing is a teacher/school action.
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      // Each teacher publishes to the subject they hold, which is what the row actually claims;
      // "not *that* subject" is covered in the academics suite.
      const subjectId = role === 'teacher' ? fixture.scienceSubjectId : fixture.mathsSubjectId;

      const response = await request(app)
        .post(`/api/v1/classes/${fixture.classAId}/academics`)
        .set('Authorization', await authFor(role))
        .send({ type: 'HOMEWORK', subjectId, title: 'Matrix', body: 'Matrix' });
      return response.status;
    },
  },
  {
    name: 'View homework',
    outcomes: {
      student: 'allow',
      parent: 'allow',
      teacher: 'allow',
      classTeacher: 'allow',
      principal: 'allow',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      // Each role reads the class it belongs to: the student is in A, the parent's child is in B,
      // and the school-wide roles reach either. There is no single class all of them are in, and
      // pretending otherwise would test one role's scope while calling it the matrix row.
      const classId = role === 'parent' ? fixture.classBId : fixture.classAId;

      const response = await request(app)
        .get(`/api/v1/classes/${classId}/academics`)
        .set('Authorization', await authFor(role));
      return response.status;
    },
  },
  {
    name: 'Publish notices',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'allow',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
        .set('Authorization', await authFor(role))
        .send({ title: 'Matrix notice', body: 'Matrix' });
      return response.status;
    },
  },
  {
    name: 'View notices',
    outcomes: {
      student: 'allow',
      parent: 'allow',
      teacher: 'allow',
      classTeacher: 'allow',
      principal: 'allow',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .get(`/api/v1/schools/${fixture.schoolAccountId}/notices`)
        .set('Authorization', await authFor(role));
      return response.status;
    },
  },
  {
    name: 'Create events',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post(`/api/v1/schools/${fixture.schoolAccountId}/events`)
        .set('Authorization', await authFor(role))
        .send({
          title: 'Matrix event',
          body: 'Matrix',
          eventAt: '2027-01-01T09:00:00.000Z',
        });
      return response.status;
    },
  },
  {
    name: 'Upload timetable',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const response = await request(app)
        .post(`/api/v1/classes/${fixture.classAId}/timetable`)
        .set('Authorization', await authFor(role))
        .send({ imageKey: 'timetables/matrix.png' });
      return response.status;
    },
  },
  {
    name: 'View timetable',
    outcomes: {
      student: 'allow',
      parent: 'allow',
      teacher: 'allow',
      classTeacher: 'allow',
      principal: 'allow',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      // Each role reads the class it belongs to, as in "View homework".
      const classId = role === 'parent' ? fixture.classBId : fixture.classAId;

      // Seeded through the API, so the row under test is one the product could produce.
      await request(app)
        .post(`/api/v1/classes/${classId}/timetable`)
        .set('Authorization', await authFor('school'))
        .send({ imageKey: 'timetables/matrix.png' });

      const response = await request(app)
        .get(`/api/v1/classes/${classId}/timetable`)
        .set('Authorization', await authFor(role));
      return response.status;
    },
  },
  {
    name: 'Update syllabus coverage',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'allow',
      classTeacher: 'allow',
      // 👁 in the matrix: a principal sees coverage, recording it is the teacher's job.
      principal: 'deny',
      school: 'allow',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      // Each teacher records against the subject they hold, as in "Publish homework".
      const subjectId = role === 'teacher' ? fixture.scienceSubjectId : fixture.mathsSubjectId;

      const response = await request(app)
        .post(`/api/v1/subjects/${subjectId}/syllabus`)
        .set('Authorization', await authFor(role))
        .send({ topic: 'Matrix chapter', percent: 25 });
      return response.status;
    },
  },
  {
    name: 'Submit leave application',
    outcomes: {
      // A student's leave is applied for by their parent (PRD 05-workflows).
      student: 'deny',
      parent: 'allow',
      teacher: 'allow',
      classTeacher: 'allow',
      principal: 'deny',
      school: 'deny',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const dates = { startDate: '2026-09-14', endDate: '2026-09-15', reason: 'Matrix' };

      // A parent applies for their child; everyone else can only try to apply for themselves.
      const response =
        role === 'parent'
          ? await request(app)
              .post(`/api/v1/children/${fixture.childId}/leave`)
              .set('Authorization', await authFor(role))
              .send(dates)
          : await request(app)
              .post('/api/v1/me/leave')
              .set('Authorization', await authFor(role))
              .send({ schoolId: fixture.schoolAccountId, ...dates });

      return response.status;
    },
  },
  {
    name: 'Approve student/parent leave',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'allow',
      principal: 'deny',
      // 👁 in the matrix: the school watches the queue, it does not decide.
      school: 'deny',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      // Class A, whose class teacher is the fixture's first teacher, and a child placed in it so
      // the application has somewhere to go.
      const child = await db.child.create({
        data: {
          parentAccountId: fixture.parentAccountId,
          fullName: 'Matrix child',
          schoolId: fixture.schoolAccountId,
          classId: fixture.classAId,
        },
        select: { id: true },
      });

      const leave = await db.leaveApplication.create({
        data: {
          kind: 'STUDENT',
          schoolId: fixture.schoolAccountId,
          classId: fixture.classAId,
          childId: child.id,
          applicantAccountId: fixture.parentAccountId,
          startDate: new Date('2026-09-14T00:00:00.000Z'),
          endDate: new Date('2026-09-15T00:00:00.000Z'),
          reason: 'Matrix',
        },
        select: { id: true },
      });

      const response = await request(app)
        .post(`/api/v1/leave/${leave.id}/decision`)
        .set('Authorization', await authFor(role))
        .send({ decision: 'ACCEPT' });

      return response.status;
    },
  },
  {
    name: 'Approve teacher leave',
    outcomes: {
      student: 'deny',
      parent: 'deny',
      teacher: 'deny',
      classTeacher: 'deny',
      principal: 'allow',
      school: 'deny',
      generalUser: 'deny',
    },
    attempt: async (role) => {
      const leave = await db.leaveApplication.create({
        data: {
          kind: 'TEACHER',
          schoolId: fixture.schoolAccountId,
          applicantAccountId: fixture.otherTeacherAccountId,
          startDate: new Date('2026-09-14T00:00:00.000Z'),
          endDate: new Date('2026-09-15T00:00:00.000Z'),
          reason: 'Matrix',
        },
        select: { id: true },
      });

      const response = await request(app)
        .post(`/api/v1/leave/${leave.id}/decision`)
        .set('Authorization', await authFor(role))
        .send({ decision: 'ACCEPT' });

      return response.status;
    },
  },
];

let cachedSecondSchool: string | undefined;
let cachedForFixture: string | undefined;

/** A school none of the fixture actors belong to, so duplicate-request conflicts cannot mask a 403. */
async function secondSchoolId(): Promise<string> {
  if (cachedSecondSchool && cachedForFixture === fixture.schoolAccountId) return cachedSecondSchool;

  const account = await db.account.create({
    data: {
      email: `matrix-school-${fixture.schoolAccountId}@fixture.test`,
      type: 'SCHOOL',
      schoolProfile: { create: { name: 'Matrix School' } },
    },
    select: { id: true },
  });

  cachedSecondSchool = account.id;
  cachedForFixture = fixture.schoolAccountId;
  return account.id;
}

describe('permission matrix', () => {
  for (const capability of CAPABILITIES) {
    describe(capability.name, () => {
      for (const role of ALL_ROLES) {
        const expected = capability.outcomes[role];

        it(`${expected === 'allow' ? 'allows' : 'refuses'} ${role}`, async () => {
          const status = await capability.attempt(role);

          if (expected === 'allow') {
            expect(status, `${role} should be allowed to: ${capability.name}`).toBeLessThan(300);
          } else {
            // 403 (forbidden) or 404 (hidden to avoid leaking existence) both count as refusal;
            // anything 2xx does not.
            expect(
              [403, 404],
              `${role} must be refused: ${capability.name} (got ${status})`,
            ).toContain(status);
          }
        });
      }
    });
  }

  it('covers every role in every capability — a forgotten column fails here', () => {
    for (const capability of CAPABILITIES) {
      expect(Object.keys(capability.outcomes).sort(), capability.name).toEqual(
        [...ALL_ROLES].sort(),
      );
    }
  });
});

/**
 * Matrix rows with no endpoint yet. Listed rather than omitted so the distance between the product
 * contract and the implementation is visible in the suite that claims to enforce it.
 */
const UNIMPLEMENTED = [
  'Submit complaints/suggestions',
  'Review complaints',
  'Manage subscription/billing',
  'Social: post/like/comment/follow/message',
  'View feed / profiles',
] as const;

describe('matrix rows not yet implemented', () => {
  it.each(UNIMPLEMENTED)('%s — no endpoint yet; add a capability here when it lands', (row) => {
    // Deliberately trivial. The value is the inventory, not the assertion: this list shrinking to
    // empty is the signal that the enforcement contract fully covers the product contract.
    expect(row).toBeTruthy();
  });
});
