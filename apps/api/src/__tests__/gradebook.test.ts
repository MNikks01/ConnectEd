/**
 * Assessments and marks — S7-6 (FR-GRADE-001 … 023).
 *
 * The authorization here is different in kind from every module before it. Elsewhere the question
 * is "are you a verified member of this class", and the whole class passes. A mark is a fact about
 * **one child**, so a classmate — a verified member of exactly the same class, by every check the
 * product had before today — must see nothing.
 *
 * So the negative cases below are the feature, and the one that matters most is the shortest:
 * a student asking for another student's mark.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { membershipScopeKey } from '../shared/db/membership-scope.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type {
  AssessmentResponse,
  AssessmentWithMarksResponse,
  MarkResponse,
  MyMarkResponse,
} from '@connected/types';
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

const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL', 'SCHOOL');

/** A second pupil in class A, so "another student's mark" is a real question. */
async function anotherPupilInClassA(name = 'Second'): Promise<string> {
  const account = await db.account.create({
    data: {
      email: `pupil-${name}-${Date.now()}@fixture.test`,
      type: 'INDIVIDUAL',
      userProfile: {
        create: { fullName: name, handle: `p${name}${Date.now()}`, role: 'STUDENT' },
      },
    },
    select: { id: true },
  });

  await db.membership.create({
    data: {
      accountId: account.id,
      schoolId: fixture.schoolAccountId,
      role: 'STUDENT',
      classId: fixture.classAId,
      status: 'VERIFIED',
      scopeKey: membershipScopeKey(fixture.classAId, null),
    },
  });

  return account.id;
}

async function createAssessment(): Promise<AssessmentResponse> {
  const response = await request(app)
    .post(`/api/v1/classes/${fixture.classAId}/assessments`)
    .send({
      subjectId: fixture.mathsSubjectId,
      kind: 'TEST',
      title: 'Fractions test',
      maxScore: '20',
      occurredOn: '2026-08-01',
    })
    .set('Authorization', await asTeacher());

  expect(response.status).toBe(201);
  return bodyAs<AssessmentResponse>(response);
}

/** Creates, marks and publishes in one go — the ordinary path most cases start from. */
async function publishedAssessment(): Promise<{ assessment: AssessmentResponse; other: string }> {
  const assessment = await createAssessment();
  const other = await anotherPupilInClassA();

  await request(app)
    .put(`/api/v1/assessments/${assessment.id}/marks`)
    .send({
      marks: [
        { studentAccountId: fixture.studentAccountId, score: '17.5' },
        { studentAccountId: other, score: '4' },
      ],
    })
    .set('Authorization', await asTeacher())
    .expect(204);

  await request(app)
    .post(`/api/v1/assessments/${assessment.id}/publish`)
    .set('Authorization', await asTeacher())
    .expect(200);

  return { assessment, other };
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

describe('creating an assessment', () => {
  it('is allowed for the teacher allocated to the subject', async () => {
    const assessment = await createAssessment();

    expect(assessment.title).toBe('Fractions test');
    expect(assessment.maxScore).toBe('20');
    expect(assessment.publishedAt).toBeNull();
  });

  it('refuses a subject belonging to another class', async () => {
    const other = await seedSchool(db);

    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/assessments`)
      .send({
        subjectId: other.mathsSubjectId,
        kind: 'TEST',
        title: 'Smuggled',
        maxScore: '20',
        occurredOn: '2026-08-01',
      })
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(404);
  });

  it('refuses a teacher not allocated to the subject', async () => {
    // The fixture gives each teacher one subject: this one owns Science, so Mathematics is the
    // question. Asking them for Science would have passed and proved nothing.
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/assessments`)
      .send({
        subjectId: fixture.mathsSubjectId,
        kind: 'TEST',
        title: 'Not mine',
        maxScore: '20',
        occurredOn: '2026-08-01',
      })
      .set('Authorization', await auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER'));

    expect(response.status).toBe(403);
  });

  it.each([
    ['a student', () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT')],
    ['a parent', () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT')],
    ['an outsider', () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER')],
  ])('refuses %s', async (_name, actor) => {
    const response = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/assessments`)
      .send({
        subjectId: fixture.mathsSubjectId,
        kind: 'TEST',
        title: 'Nope',
        maxScore: '20',
        occurredOn: '2026-08-01',
      })
      .set('Authorization', await actor());

    expect(response.status).toBe(403);
  });
});

describe('entering marks', () => {
  it('stores a decimal score exactly', async () => {
    const assessment = await createAssessment();

    await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({ marks: [{ studentAccountId: fixture.studentAccountId, score: '17.5' }] })
      .set('Authorization', await asTeacher())
      .expect(204);

    const marks = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await asTeacher());

    // A string, and still 17.5. Through a JS number this is where 17.5 would become 17.499999…
    expect(bodyAs<AssessmentWithMarksResponse>(marks).marks[0]?.score).toBe('17.5');
  });

  it('keeps "not marked" distinct from zero', async () => {
    const assessment = await createAssessment();

    await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({ marks: [{ studentAccountId: fixture.studentAccountId, score: null }] })
      .set('Authorization', await asTeacher())
      .expect(204);

    const marks = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<AssessmentWithMarksResponse>(marks).marks[0]?.score).toBeNull();
  });

  it('refuses a pupil who is not a verified student of the class', async () => {
    // Without this a teacher could write a mark against any account in the product — and that mark
    // would then be readable by that account's parent.
    const assessment = await createAssessment();

    const response = await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({ marks: [{ studentAccountId: fixture.outsiderAccountId, score: '10' }] })
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(404);
  });

  it('refuses a bulk overwrite once published', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({ marks: [{ studentAccountId: fixture.studentAccountId, score: '1' }] })
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(409);
  });
});

describe('a draft is not a result', () => {
  it('is invisible to the pupil until published', async () => {
    const assessment = await createAssessment();

    await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({ marks: [{ studentAccountId: fixture.studentAccountId, score: '17.5' }] })
      .set('Authorization', await asTeacher())
      .expect(204);

    const mine = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/marks`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    expect(mine.status).toBe(200);
    expect(bodyAs<{ data: MyMarkResponse[] }>(mine).data).toHaveLength(0);
  });

  it('appears once published', async () => {
    await publishedAssessment();

    const mine = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/marks`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    const { data } = bodyAs<{ data: MyMarkResponse[] }>(mine);
    expect(data).toHaveLength(1);
    expect(data[0]?.mark?.score).toBe('17.5');
  });

  it('records the publish as an outbox event carrying no score', async () => {
    await publishedAssessment();

    const row = await db.outboxEvent.findFirstOrThrow({ where: { type: 'marks.published' } });
    const payload = row.payload as unknown as Record<string, unknown>;

    expect(payload.title).toBe('Fractions test');

    // The key set, not a substring of the serialised payload.
    //
    // `expect(JSON.stringify(payload)).not.toContain('17.5')` was the obvious way to write this and
    // it was wrong in both directions. It failed on 2026-08-12 against an unchanged payload,
    // because `occurredAt` read `…T07:13:17.571Z` — seconds `17`, milliseconds `571` — which spells
    // `17.5`. Any second-and-millisecond pair can do that, so the test broke roughly once every six
    // hundred runs on a clock nobody controls, and it would have done it on a release.
    //
    // The quieter half is worse. Searching the text for `17.5` only catches a leak that happens to
    // spell those characters; it says nothing about a *derived* result, which is the same
    // disclosure. A payload carrying `grade: 'B+'` — this pupil's mark, in the form a parent
    // actually reads — passes the old assertion untouched. Both were checked by sabotage: adding
    // `topScore` and adding `grade` each fail the assertion below, and only the first would have
    // failed the one it replaces.
    //
    // Pinning the keys states what the payload may hold rather than what one value must not look
    // like, so a result added under any name, in any shape, fails here.
    expect(Object.keys(payload).sort()).toEqual([
      'assessmentId',
      'classId',
      'eventId',
      'occurredAt',
      'subjectId',
      'title',
      'type',
    ]);
  });
});

describe('who may read a mark', () => {
  it('a pupil sees their own and not their classmate’s', async () => {
    const { other } = await publishedAssessment();

    const mine = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/marks`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    const { data } = bodyAs<{ data: MyMarkResponse[] }>(mine);
    expect(data[0]?.mark?.score).toBe('17.5');
    // The classmate scored 4. Nothing in this response may mention it.
    expect(JSON.stringify(data)).not.toContain('"4"');
    expect(JSON.stringify(data)).not.toContain(other);
  });

  it('a pupil cannot read the marking view, which holds everybody’s', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    expect(response.status).toBe(403);
  });

  it('a pupil in another class sees nothing of this one', async () => {
    await publishedAssessment();

    const response = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/marks`)
      .set('Authorization', await auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'));

    // A parent is a verified member of a class, and has no marks of their own. Without the
    // STUDENT-membership check this would have fallen through to an empty list rather than a 404,
    // which reads as "you have none" instead of "this is not your question".
    expect(response.status).toBe(404);
  });

  it('a teacher of another subject in the same class is refused', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER'));

    expect(response.status).toBe(403);
  });

  it('the principal sees published marks', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'));

    expect(response.status).toBe(200);
    expect(bodyAs<AssessmentWithMarksResponse>(response).marks).toHaveLength(2);
  });

  it('the principal does not see a draft', async () => {
    const assessment = await createAssessment();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'));

    expect(response.status).toBe(404);
  });

  it('the school sees a draft in the class list, not only by id', async () => {
    // The two endpoints disagreed until S8-3: `listMarks` gave the school drafts and the class
    // list did not, so a draft was openable by id and invisible in the only place a school would
    // find one.
    await createAssessment();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/assessments`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(200);
    expect(bodyAs<{ data: AssessmentResponse[] }>(response).data).toHaveLength(1);
  });

  it('a principal does not see a draft in the class list', async () => {
    await createAssessment();

    const response = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/assessments`)
      .set('Authorization', await auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'));

    expect(response.status).toBe(200);
    expect(bodyAs<{ data: AssessmentResponse[] }>(response).data).toHaveLength(0);
  });

  it('the school sees everything, including a draft', async () => {
    const assessment = await createAssessment();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await asSchool());

    expect(response.status).toBe(200);
  });

  it('an outsider sees nothing', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'));

    expect(response.status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app).get(`/api/v1/assessments/${assessment.id}/marks`);

    expect(response.status).toBe(401);
  });
});

describe('a parent reads through the link the school confirmed', () => {
  /** Puts the fixture's child in class A and links it to the fixture's student. */
  async function linkChildToStudent(): Promise<void> {
    await db.child.update({
      where: { id: fixture.childId },
      data: { classId: fixture.classAId, studentAccountId: fixture.studentAccountId },
    });
    await db.membership.updateMany({
      where: { accountId: fixture.parentAccountId, childId: fixture.childId },
      data: {
        classId: fixture.classAId,
        scopeKey: membershipScopeKey(fixture.classAId, fixture.childId),
      },
    });
  }

  it('sees their own child’s mark', async () => {
    await publishedAssessment();
    await linkChildToStudent();

    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/marks`)
      .set('Authorization', await auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'));

    expect(response.status).toBe(200);
    const { data } = bodyAs<{ data: MyMarkResponse[] }>(response);
    expect(data[0]?.mark?.score).toBe('17.5');
  });

  it('is refused while the school has not linked the child', async () => {
    await publishedAssessment();

    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/marks`)
      .set('Authorization', await auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'));

    // Refusing is the only safe answer. Guessing which pupil this child is — by name, or by being
    // the only one in the class — is how one family ends up reading another's results.
    expect(response.status).toBe(404);
  });

  it('cannot read another parent’s child', async () => {
    await publishedAssessment();
    await linkChildToStudent();

    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/marks`)
      .set('Authorization', await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'));

    expect(response.status).toBe(404);
  });
});

describe('corrections', () => {
  it('records what the mark used to be', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .patch(`/api/v1/assessments/${assessment.id}/marks/${fixture.studentAccountId}`)
      .send({ score: '18' })
      .set('Authorization', await asTeacher());

    expect(response.status).toBe(200);
    expect(bodyAs<MarkResponse>(response).score).toBe('18');

    const entry = await db.auditLog.findFirstOrThrow({
      where: { action: 'mark.corrected', entityId: assessment.id },
    });
    const metadata = entry.metadata as { previousScore: string; newScore: string };
    expect(metadata.previousScore).toBe('17.5');
    expect(metadata.newScore).toBe('18');
  });

  it('is refused for a teacher of another subject', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .patch(`/api/v1/assessments/${assessment.id}/marks/${fixture.studentAccountId}`)
      .send({ score: '20' })
      .set('Authorization', await auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER'));

    expect(response.status).toBe(403);
  });

  it('is refused for the pupil themselves', async () => {
    const { assessment } = await publishedAssessment();

    const response = await request(app)
      .patch(`/api/v1/assessments/${assessment.id}/marks/${fixture.studentAccountId}`)
      .send({ score: '20' })
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    expect(response.status).toBe(403);
  });
});

describe('the staff note (FR-GRADE-015)', () => {
  /** A published assessment where the pupil has both a shared remark and a staff note. */
  async function withBothNotes(): Promise<AssessmentResponse> {
    const assessment = await createAssessment();

    await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({
        marks: [
          {
            studentAccountId: fixture.studentAccountId,
            score: '17.5',
            remark: 'Strong on fractions.',
            staffNote: 'Seemed upset before the test.',
          },
        ],
      })
      .set('Authorization', await asTeacher())
      .expect(204);

    await request(app)
      .post(`/api/v1/assessments/${assessment.id}/publish`)
      .set('Authorization', await asTeacher())
      .expect(200);

    return assessment;
  }

  it('is visible to the teacher who wrote it', async () => {
    const assessment = await withBothNotes();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await asTeacher());

    expect(bodyAs<AssessmentWithMarksResponse>(response).marks[0]?.staffNote).toBe(
      'Seemed upset before the test.',
    );
  });

  it('is visible to the school', async () => {
    const assessment = await withBothNotes();

    const response = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await asSchool());

    expect(bodyAs<AssessmentWithMarksResponse>(response).marks[0]?.staffNote).toBeTruthy();
  });

  it('never reaches the pupil — not the field, not the words', async () => {
    await withBothNotes();

    const response = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/marks`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));

    // The shared remark does arrive: the distinction is the point, not silence.
    expect(JSON.stringify(response.body)).toContain('Strong on fractions.');
    // And the note does not — asserted on the raw body, because a field the pupil's response type
    // cannot hold would still leak if somebody serialised the row directly.
    expect(JSON.stringify(response.body)).not.toContain('upset');
    expect(JSON.stringify(response.body)).not.toContain('staffNote');
  });

  it('never reaches the parent', async () => {
    await db.child.update({
      where: { id: fixture.childId },
      data: { classId: fixture.classAId, studentAccountId: fixture.studentAccountId },
    });
    await db.membership.updateMany({
      where: { accountId: fixture.parentAccountId, childId: fixture.childId },
      data: {
        classId: fixture.classAId,
        scopeKey: membershipScopeKey(fixture.classAId, fixture.childId),
      },
    });
    await withBothNotes();

    const response = await request(app)
      .get(`/api/v1/children/${fixture.childId}/marks`)
      .set('Authorization', await auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'));

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain('Strong on fractions.');
    expect(JSON.stringify(response.body)).not.toContain('upset');
  });

  it('survives a correction', async () => {
    const assessment = await withBothNotes();

    await request(app)
      .patch(`/api/v1/assessments/${assessment.id}/marks/${fixture.studentAccountId}`)
      .send({ score: '18', staffNote: 'Spoke to them; all fine now.' })
      .set('Authorization', await asTeacher())
      .expect(200);

    const staff = await request(app)
      .get(`/api/v1/assessments/${assessment.id}/marks`)
      .set('Authorization', await asTeacher());
    expect(bodyAs<AssessmentWithMarksResponse>(staff).marks[0]?.staffNote).toBe(
      'Spoke to them; all fine now.',
    );

    const pupil = await request(app)
      .get(`/api/v1/me/classes/${fixture.classAId}/marks`)
      .set('Authorization', await auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'));
    expect(JSON.stringify(pupil.body)).not.toContain('Spoke to them');
  });
});
