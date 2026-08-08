/**
 * Report cards — S8-7 (FR-GRADE-030 … 043).
 *
 * The whole feature turns on one claim, and it is the one this suite exists to hold: **a card is a
 * snapshot, not a view.** Every other test here is arithmetic or access control; the test that
 * would make the feature worthless if it broke is the one that corrects a mark after issue and
 * expects the card not to move.
 *
 * The second thing being pinned is the arithmetic rule carried through from the gradebook: an
 * assessment a pupil was not marked for is excluded from *both* sides of the total. It is easy to
 * write that as a zero by accident, and a zero would quietly turn a missed test into a bad term.
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
import type { AssessmentResponse, ReportCardResponse, TermResponse } from '@connected/types';
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

/** The fixture's main teacher is class teacher of A *and* the Mathematics teacher. */
const asClassTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
/** Allocated to Science only, and class teacher of nothing — the subject-teacher case. */
const asSubjectTeacher = () => auth(fixture.otherTeacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asPrincipal = () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL', 'SCHOOL');

/** The assessments the helpers create all sit inside this range. */
const TERM = { name: 'Term 1', startDate: '2026-07-01', endDate: '2026-09-30' };

async function createTerm(body: Record<string, string> = TERM): Promise<TermResponse> {
  const response = await request(app)
    .post(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
    .send(body)
    .set('Authorization', await asSchool());

  expect(response.status).toBe(201);
  return bodyAs<TermResponse>(response);
}

/** A second pupil in class A, so a class of one never hides a per-pupil mistake. */
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

async function createAssessment(
  title = 'Fractions test',
  occurredOn = '2026-08-01',
): Promise<AssessmentResponse> {
  const response = await request(app)
    .post(`/api/v1/classes/${fixture.classAId}/assessments`)
    .send({
      subjectId: fixture.mathsSubjectId,
      kind: 'TEST',
      title,
      maxScore: '20',
      occurredOn,
    })
    .set('Authorization', await asClassTeacher());

  expect(response.status).toBe(201);
  return bodyAs<AssessmentResponse>(response);
}

async function mark(
  assessmentId: string,
  marks: { studentAccountId: string; score: string | null }[],
) {
  await request(app)
    .put(`/api/v1/assessments/${assessmentId}/marks`)
    .send({ marks })
    .set('Authorization', await asClassTeacher())
    .expect(204);
}

async function publish(assessmentId: string) {
  await request(app)
    .post(`/api/v1/assessments/${assessmentId}/publish`)
    .set('Authorization', await asClassTeacher())
    .expect(200);
}

async function issue(termId: string, comments?: Record<string, string>) {
  return request(app)
    .post(`/api/v1/classes/${fixture.classAId}/report-cards`)
    .send({ termId, ...(comments ? { comments } : {}) })
    .set('Authorization', await asClassTeacher());
}

/** One published, marked assessment and a term covering it — where most cases start. */
async function issuedTerm(): Promise<{ term: TermResponse; card: ReportCardResponse }> {
  const term = await createTerm();
  const assessment = await createAssessment();

  await mark(assessment.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
  await publish(assessment.id);
  expect((await issue(term.id)).status).toBe(204);

  const cards = await request(app)
    .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
    .set('Authorization', await asClassTeacher());

  const card = bodyAs<{ data: ReportCardResponse[] }>(cards).data.find(
    (row) => row.studentAccountId === fixture.studentAccountId,
  );

  expect(card).toBeDefined();
  return { term, card: card as ReportCardResponse };
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

describe('terms', () => {
  it('is the school that defines one', async () => {
    const term = await createTerm();

    expect(term.name).toBe('Term 1');
    expect(term.startDate).toBe('2026-07-01');
    // Nothing issued against it yet, so its dates are still the school's to change.
    expect(term.frozen).toBe(false);
  });

  it('refuses a range that overlaps an existing term', async () => {
    await createTerm();

    const clash = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
      .send({ name: 'Term 2', startDate: '2026-09-01', endDate: '2026-12-20' })
      .set('Authorization', await asSchool());

    // An assessment must belong to one term or none (FR-GRADE-030): overlapping terms would put
    // the same test on two cards under two names.
    expect(clash.status).toBe(409);
  });

  it('refuses a range that merely touches one, because a day belongs to one term', async () => {
    await createTerm();

    const touching = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
      .send({ name: 'Term 2', startDate: '2026-09-30', endDate: '2026-12-20' })
      .set('Authorization', await asSchool());

    expect(touching.status).toBe(409);
  });

  it('allows the next term to start the day after', async () => {
    await createTerm();

    const next = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
      .send({ name: 'Term 2', startDate: '2026-10-01', endDate: '2026-12-20' })
      .set('Authorization', await asSchool());

    expect(next.status).toBe(201);
  });

  it('refuses a term that ends before it starts', async () => {
    const backwards = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
      .send({ name: 'Term 1', startDate: '2026-09-30', endDate: '2026-07-01' })
      .set('Authorization', await asSchool());

    expect(backwards.status).toBe(422);
  });

  it('is not a teacher’s to define', async () => {
    const attempt = await request(app)
      .post(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
      .send(TERM)
      .set('Authorization', await asClassTeacher());

    expect(attempt.status).toBe(403);
  });

  it('is frozen once a card has been issued against it', async () => {
    const { term } = await issuedTerm();

    const listed = await request(app)
      .get(`/api/v1/schools/${fixture.schoolAccountId}/terms`)
      .set('Authorization', await asSchool());

    const found = bodyAs<{ data: TermResponse[] }>(listed).data.find((row) => row.id === term.id);
    expect(found?.frozen).toBe(true);
  });
});

describe('the arithmetic on a card', () => {
  it('totals the published assessments a pupil was marked for', async () => {
    const { card } = await issuedTerm();

    const maths = card.snapshot.subjects.find((subject) => subject.subjectName === 'Mathematics');
    expect(maths?.scored).toBe('17.50');
    expect(maths?.available).toBe('20.00');
    expect(maths?.percent).toBe(88);
    expect(card.snapshot.overallPercent).toBe(88);
  });

  it('excludes an unmarked assessment from both sides, rather than scoring it zero', async () => {
    const term = await createTerm();

    const sat = await createAssessment('Fractions test', '2026-08-01');
    const missed = await createAssessment('Decimals test', '2026-08-15');

    await mark(sat.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    // Explicitly not marked — the pupil was away, and being away is not a score of zero.
    await mark(missed.id, [{ studentAccountId: fixture.studentAccountId, score: null }]);
    await publish(sat.id);
    await publish(missed.id);

    expect((await issue(term.id)).status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const card = bodyAs<{ data: ReportCardResponse[] }>(cards).data.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );
    const maths = card?.snapshot.subjects.find((s) => s.subjectName === 'Mathematics');

    // Both assessments are listed — the card is honest about what was set — but only the one that
    // was marked reaches the total. Counting the second would give 17.5/40 and read as 44%.
    expect(maths?.assessments).toHaveLength(2);
    expect(maths?.assessments.find((a) => a.title === 'Decimals test')?.score).toBeNull();
    expect(maths?.scored).toBe('17.50');
    expect(maths?.available).toBe('20.00');
    expect(maths?.percent).toBe(88);
  });

  it('has no percentage at all for a pupil with nothing marked', async () => {
    const term = await createTerm();
    const assessment = await createAssessment();
    const other = await anotherPupilInClassA();

    await mark(assessment.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    await publish(assessment.id);
    expect((await issue(term.id)).status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const card = bodyAs<{ data: ReportCardResponse[] }>(cards).data.find(
      (row) => row.studentAccountId === other,
    );

    // Null, not 0: a child with no marks has no percentage, and printing 0% would say something
    // false about them on a document their family keeps.
    expect(card?.snapshot.overallPercent).toBeNull();
    expect(card?.snapshot.subjects[0]?.percent).toBeNull();
  });

  it('leaves an unpublished assessment off the card entirely', async () => {
    const term = await createTerm();
    const published = await createAssessment('Fractions test', '2026-08-01');
    const draft = await createAssessment('Draft test', '2026-08-20');

    await mark(published.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    await mark(draft.id, [{ studentAccountId: fixture.studentAccountId, score: '2' }]);
    await publish(published.id);

    expect((await issue(term.id)).status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const card = bodyAs<{ data: ReportCardResponse[] }>(cards).data.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );
    const titles = card?.snapshot.subjects.flatMap((s) => s.assessments.map((a) => a.title));

    // A draft mark is one the teacher has not stood behind yet. Issuing must not be the back door
    // that publishes it (FR-GRADE-032).
    expect(titles).toEqual(['Fractions test']);
    expect(card?.snapshot.subjects[0]?.available).toBe('20.00');
  });

  it('ignores an assessment sat outside the term', async () => {
    const term = await createTerm();
    const inside = await createAssessment('Fractions test', '2026-08-01');
    const outside = await createAssessment('Last term’s test', '2026-06-01');

    await mark(inside.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    await mark(outside.id, [{ studentAccountId: fixture.studentAccountId, score: '20' }]);
    await publish(inside.id);
    await publish(outside.id);

    expect((await issue(term.id)).status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const card = bodyAs<{ data: ReportCardResponse[] }>(cards).data.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );

    expect(card?.snapshot.subjects[0]?.assessments).toHaveLength(1);
    expect(card?.snapshot.overallPercent).toBe(88);
  });

  it('counts the term’s attendance, and does not turn it into a percentage', async () => {
    const term = await createTerm();
    const assessment = await createAssessment();

    await mark(assessment.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    await publish(assessment.id);

    for (const [onDate, state] of [
      ['2026-08-03', 'PRESENT'],
      ['2026-08-04', 'ABSENT'],
      ['2026-08-05', 'LATE'],
      // Outside the term, so it must not reach the card.
      ['2026-06-05', 'ABSENT'],
    ] as const) {
      await db.attendanceEntry.create({
        data: {
          classId: fixture.classAId,
          studentAccountId: fixture.studentAccountId,
          onDate: new Date(`${onDate}T00:00:00.000Z`),
          state,
          takenByAccountId: fixture.teacherAccountId,
        },
      });
    }

    expect((await issue(term.id)).status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const card = bodyAs<{ data: ReportCardResponse[] }>(cards).data.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );

    expect(card?.snapshot.attendance).toEqual({ present: 1, absent: 1, late: 1, excused: 0 });
  });
});

describe('issuing', () => {
  it('covers the whole class in one action', async () => {
    const term = await createTerm();
    const other = await anotherPupilInClassA();
    const assessment = await createAssessment();

    await mark(assessment.id, [
      { studentAccountId: fixture.studentAccountId, score: '17.5' },
      { studentAccountId: other, score: '4' },
    ]);
    await publish(assessment.id);

    expect((await issue(term.id)).status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    // A term where half the class has a card is itself information about who the school got to
    // (FR-GRADE-040).
    expect(bodyAs<{ data: ReportCardResponse[] }>(cards).data).toHaveLength(2);
  });

  it('stores the class teacher’s comment against the right pupil', async () => {
    const term = await createTerm();
    const other = await anotherPupilInClassA();
    const assessment = await createAssessment();

    await mark(assessment.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    await publish(assessment.id);

    const response = await issue(term.id, {
      [fixture.studentAccountId]: 'A strong term.',
    });
    expect(response.status).toBe(204);

    const cards = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());
    const data = bodyAs<{ data: ReportCardResponse[] }>(cards).data;

    // Two pupils, one comment: with a class of one, "the comment landed on the right card" and
    // "the comment landed on the first card" are the same assertion.
    expect(data.find((row) => row.studentAccountId === fixture.studentAccountId)?.comment).toBe(
      'A strong term.',
    );
    expect(data.find((row) => row.studentAccountId === other)?.comment).toBeNull();
  });

  it('does not move a card when a mark is corrected afterwards', async () => {
    const { term, card } = await issuedTerm();

    const assessment = await db.assessment.findFirstOrThrow({
      where: { classId: fixture.classAId },
      select: { id: true },
    });

    await request(app)
      .patch(`/api/v1/assessments/${assessment.id}/marks/${fixture.studentAccountId}`)
      .send({ score: '4', reason: 'Added the second page.' })
      .set('Authorization', await asClassTeacher())
      .expect(200);

    const after = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const reread = bodyAs<{ data: ReportCardResponse[] }>(after).data.find(
      (row) => row.studentAccountId === fixture.studentAccountId,
    );

    // This is the feature. A family keeps the document they were given, and a document that
    // rewrites itself is not one (FR-GRADE-041).
    expect(reread?.snapshot.subjects[0]?.scored).toBe('17.50');
    expect(reread?.snapshot.overallPercent).toBe(88);
    expect(reread?.issuedAt).toBe(card.issuedAt);
  });

  it('records a reissue on the card and in the audit log', async () => {
    const { term } = await issuedTerm();

    const assessment = await db.assessment.findFirstOrThrow({
      where: { classId: fixture.classAId },
      select: { id: true },
    });

    await request(app)
      .patch(`/api/v1/assessments/${assessment.id}/marks/${fixture.studentAccountId}`)
      .send({ score: '4', reason: 'Added the second page.' })
      .set('Authorization', await asClassTeacher())
      .expect(200);

    expect((await issue(term.id)).status).toBe(204);

    const after = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asClassTeacher());

    const data = bodyAs<{ data: ReportCardResponse[] }>(after).data;
    const reissued = data.find((row) => row.studentAccountId === fixture.studentAccountId);

    // One card per pupil per term, showing on its face that it replaced an earlier one — not two
    // documents with the same name and no way to tell which a parent is holding (FR-GRADE-042).
    expect(data).toHaveLength(1);
    expect(reissued?.snapshot.subjects[0]?.scored).toBe('4.00');
    expect(reissued?.replacedIssuedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: 'report_card.reissued' } })).toBe(1);
  });

  it('is not a subject teacher’s to do', async () => {
    const term = await createTerm();

    const attempt = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/report-cards`)
      .send({ termId: term.id })
      .set('Authorization', await asSubjectTeacher());

    // The class teacher answers for the class (FR-INST-004); two people issuing is how a class
    // ends up with two answers about the same child.
    expect(attempt.status).toBe(403);
  });

  it('refuses a term belonging to another school', async () => {
    const other = await seedSchool(db);

    const theirTerm = await request(app)
      .post(`/api/v1/schools/${other.schoolAccountId}/terms`)
      .send(TERM)
      .set('Authorization', await auth(other.schoolAccountId, 'SCHOOL', 'SCHOOL'));
    expect(theirTerm.status).toBe(201);

    const attempt = await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/report-cards`)
      .send({ termId: bodyAs<TermResponse>(theirTerm).id })
      .set('Authorization', await asClassTeacher());

    // 404, not 403: whether another school has a term called "Term 1" is not this school's to
    // learn (`.docs/API/01-conventions.md`).
    expect(attempt.status).toBe(404);
  });
});

describe('who sees a card', () => {
  it('shows a pupil their own', async () => {
    await issuedTerm();

    const mine = await request(app)
      .get('/api/v1/me/report-cards')
      .set('Authorization', await asStudent());

    expect(mine.status).toBe(200);
    expect(bodyAs<{ data: ReportCardResponse[] }>(mine).data).toHaveLength(1);
  });

  it('shows a parent their child’s, through the school-confirmed link', async () => {
    // Both halves of the link, as the school would set them: the child moves to class A *and* the
    // parent's membership moves with it. The scope key is what the verification is against, so a
    // child updated without it is a child whose parent is verified for somewhere else.
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

    await issuedTerm();

    const theirs = await request(app)
      .get(`/api/v1/children/${fixture.childId}/report-cards`)
      .set('Authorization', await asParent());

    expect(theirs.status).toBe(200);
    expect(bodyAs<{ data: ReportCardResponse[] }>(theirs).data).toHaveLength(1);
  });

  it('refuses a parent while the school has not linked the child', async () => {
    await issuedTerm();

    const theirs = await request(app)
      .get(`/api/v1/children/${fixture.childId}/report-cards`)
      .set('Authorization', await asParent());

    // Guessing which pupil this child is would be how one family reads another's record.
    expect(theirs.status).toBe(404);
  });

  it('shows the principal every card in the school', async () => {
    const { term } = await issuedTerm();

    const seen = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asPrincipal());

    expect(seen.status).toBe(200);
    expect(bodyAs<{ data: ReportCardResponse[] }>(seen).data).toHaveLength(1);
  });

  it('shows the school everything', async () => {
    const { term } = await issuedTerm();

    const seen = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asSchool());

    expect(seen.status).toBe(200);
  });

  it('shows a subject teacher nothing, unlike marks', async () => {
    const { term } = await issuedTerm();

    const attempt = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await asSubjectTeacher());

    // The deliberate difference from the gradebook, where this same teacher reads their own
    // subject's marks. A card spans a child's whole term, and teaching them Science is not a
    // reason to read the rest of it.
    expect(attempt.status).toBe(403);
  });

  it('shows an outsider nothing', async () => {
    const { term } = await issuedTerm();

    const attempt = await request(app)
      .get(`/api/v1/classes/${fixture.classAId}/report-cards?termId=${term.id}`)
      .set('Authorization', await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'));

    expect(attempt.status).toBe(403);
  });

  it('gives a pupil nothing before the class has been issued', async () => {
    await createTerm();
    const assessment = await createAssessment();
    await mark(assessment.id, [{ studentAccountId: fixture.studentAccountId, score: '17.5' }]);
    await publish(assessment.id);

    const mine = await request(app)
      .get('/api/v1/me/report-cards')
      .set('Authorization', await asStudent());

    // Same shape as a draft mark: before issue, a card does not exist for a family (FR-GRADE-043).
    expect(bodyAs<{ data: ReportCardResponse[] }>(mine).data).toEqual([]);
  });

  it('does not put a staff note on a card', async () => {
    const term = await createTerm();
    const assessment = await createAssessment();

    await request(app)
      .put(`/api/v1/assessments/${assessment.id}/marks`)
      .send({
        marks: [
          {
            studentAccountId: fixture.studentAccountId,
            score: '17.5',
            staffNote: 'Spoke to the parents about attendance.',
          },
        ],
      })
      .set('Authorization', await asClassTeacher())
      .expect(204);

    await publish(assessment.id);
    expect((await issue(term.id)).status).toBe(204);

    const mine = await request(app)
      .get('/api/v1/me/report-cards')
      .set('Authorization', await asStudent());

    // FR-GRADE-036. The card carries what a family is owed about their own child, and a note
    // written for colleagues is not that.
    expect(JSON.stringify(bodyAs<{ data: ReportCardResponse[] }>(mine).data)).not.toContain(
      'Spoke to the parents',
    );
  });
});
