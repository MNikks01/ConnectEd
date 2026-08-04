/**
 * The moderation queue — S6-5, S6-6 (ADR-0017).
 *
 * This closes the product's oldest unkept promise: children have been able to report content since
 * S4-8 and nothing read the result. It is also the first capability that acts on content the actor
 * does not own, so most of what is asserted here is restraint rather than function —
 *
 * - **nobody with a product role can see the queue**, including the school and the principal;
 * - **the reporter is never in a response**, because the form promises nobody at their school is
 *   told and a DTO is where that promise is kept or broken;
 * - **`ACTIONED` means the content actually went**, so the button is not decorative;
 * - **every decision is audited**, because an unreviewable power over other people's words is not
 *   one this product should have.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { QueuedReportResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

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

const asAdmin = () => auth(fixture.platformAdminAccountId, 'INDIVIDUAL', 'USER');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');

/** A post by the teacher, reported by the student. Returns both ids. */
async function reportedPost(body = 'Something objectionable.') {
  const post = bodyAs<{ id: string }>(
    await request(app)
      .post('/api/v1/posts')
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'))
      .send({ body }),
  );

  const report = bodyAs<{ id: string }>(
    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'POST', subjectId: post.id, reason: 'This is not appropriate.' }),
  );

  return { postId: post.id, reportId: report.id };
}

const queue = async (query = '') =>
  request(app)
    .get(`/api/v1/admin/reports${query}`)
    .set('Authorization', await asAdmin());

const decide = async (reportId: string, body: unknown) =>
  request(app)
    .post(`/api/v1/admin/reports/${reportId}/decision`)
    .set('Authorization', await asAdmin())
    .send(body as never);

describe('who may read the queue', () => {
  it('lets a platform admin in', async () => {
    await reportedPost();

    const response = await queue();

    expect(response.status).toBe(200);
    expect(bodyAs<{ data: QueuedReportResponse[] }>(response).data).toHaveLength(1);
  });

  it('404s for every product role, including the school', async () => {
    await reportedPost();

    for (const [accountId, kind, role] of [
      [fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT'],
      [fixture.parentAccountId, 'INDIVIDUAL', 'PARENT'],
      [fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'],
      [fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL'],
      [fixture.schoolAccountId, 'SCHOOL', undefined],
      [fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'],
    ] as const) {
      const response = await request(app)
        .get('/api/v1/admin/reports')
        .set('Authorization', await auth(accountId, kind, role));

      // 404, not 403: the queue's existence is not something an ordinary account can confirm.
      expect(response.status, `${role ?? kind} should not reach the queue`).toBe(404);
    }
  });

  it('is not fooled by a token that claims the role', async () => {
    await reportedPost();

    // The integration suite signs its own tokens, so a `platformAdmin` claim would be one line
    // away from being the most privileged thing in the product. The policy reads the row.
    const token = await tokens.signAccessToken({
      sub: fixture.studentAccountId,
      accountType: 'INDIVIDUAL',
      role: 'USER',
      isPlatformAdmin: true,
    } as never);

    const response = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('drops a suspended staff account', async () => {
    await reportedPost();
    await db.account.update({
      where: { id: fixture.platformAdminAccountId },
      data: { status: 'SUSPENDED' },
    });

    expect((await queue()).status).toBe(404);
  });

  it('revokes immediately rather than when the token expires', async () => {
    await reportedPost();
    const authorization = await asAdmin();

    expect(
      (await request(app).get('/api/v1/admin/reports').set('Authorization', authorization)).status,
    ).toBe(200);

    await db.account.update({
      where: { id: fixture.platformAdminAccountId },
      data: { isPlatformAdmin: false },
    });

    // Same token, one query later. This is the whole reason the flag is not a claim.
    expect(
      (await request(app).get('/api/v1/admin/reports').set('Authorization', authorization)).status,
    ).toBe(404);
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await request(app).get('/api/v1/admin/reports')).status).toBe(401);
  });
});

describe('what the queue shows', () => {
  it('shows the reported content and who wrote it', async () => {
    await reportedPost('Something objectionable.');

    const [report] = bodyAs<{ data: QueuedReportResponse[] }>(await queue()).data;

    expect(report?.subject.excerpt).toBe('Something objectionable.');
    expect(report?.subject.authorAccountId).toBe(fixture.teacherAccountId);
    expect(report?.reason).toBe('This is not appropriate.');
  });

  it('never names the reporter', async () => {
    await reportedPost();

    const body = JSON.stringify(bodyAs<unknown>(await queue()));

    // The form promises that nobody at the reporter's school is told. That promise is kept here,
    // in the shape, rather than in whichever UI happens to render it.
    expect(body).not.toContain(fixture.studentAccountId);
  });

  it('says how many people reported the same thing', async () => {
    const { postId } = await reportedPost();

    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER'))
      .send({ subjectType: 'POST', subjectId: postId, reason: 'Agreed.' });

    const [report] = bodyAs<{ data: QueuedReportResponse[] }>(await queue()).data;

    // Two people objecting is a different signal from one, and the unique constraint means this
    // counts people rather than clicks.
    expect(report?.reportCount).toBe(2);
  });

  it('works the queue oldest first', async () => {
    const first = await reportedPost('Older.');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await reportedPost('Newer.');

    const ids = bodyAs<{ data: QueuedReportResponse[] }>(await queue()).data.map((row) => row.id);

    // Unlike every other list in this API. A queue is worked from the front; newest-first would
    // leave the oldest complaint permanently at the bottom.
    expect(ids).toEqual([first.reportId, second.reportId]);
  });

  it('filters by status', async () => {
    const { reportId } = await reportedPost();
    await decide(reportId, { decision: 'DISMISSED' });

    expect(bodyAs<{ data: unknown[] }>(await queue('?status=OPEN')).data).toHaveLength(0);
    expect(bodyAs<{ data: unknown[] }>(await queue('?status=DISMISSED')).data).toHaveLength(1);
  });

  it('shows the whole queue for a status nobody recognises', async () => {
    await reportedPost();

    // A queue filter, not an API contract: a typo shows everything rather than an error page.
    expect(bodyAs<{ data: unknown[] }>(await queue('?status=NONSENSE')).data).toHaveLength(1);
  });

  it('still shows a report about content its author already deleted', async () => {
    const { postId } = await reportedPost();
    await request(app)
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'));

    const [report] = bodyAs<{ data: QueuedReportResponse[] }>(await queue()).data;

    // The case moderation most needs: the content is gone, the complaint is not.
    expect(report?.subject.removed).toBe(true);
    expect(report?.subject.excerpt).toBe('Something objectionable.');
  });

  it('does not put a private message on a reviewer’s screen', async () => {
    const thread = bodyAs<{ id: string }>(
      await request(app)
        .post('/api/v1/threads')
        .set('Authorization', await asStudent())
        .send({ accountId: fixture.teacherAccountId }),
    );
    const message = bodyAs<{ id: string }>(
      await request(app)
        .post(`/api/v1/threads/${thread.id}/messages`)
        .set('Authorization', await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'))
        .send({ body: 'Something private and unpleasant.' }),
    );

    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', await asStudent())
      .send({ subjectType: 'MESSAGE', subjectId: message.id, reason: 'He said something awful.' });

    const [report] = bodyAs<{ data: QueuedReportResponse[] }>(await queue()).data;

    // A private conversation is not made public by one party reporting it. The reviewer gets the
    // sender and the reporter's description, which is enough to act on an account.
    expect(report?.subject.excerpt).toBeNull();
    expect(report?.subject.authorAccountId).toBe(fixture.teacherAccountId);
    expect(JSON.stringify(report)).not.toContain('Something private');
  });
});

describe('deciding', () => {
  it('dismisses without touching the content', async () => {
    const { postId, reportId } = await reportedPost();

    const response = await decide(reportId, { decision: 'DISMISSED', note: 'Looked at it.' });

    expect(response.status).toBe(200);
    expect(bodyAs<QueuedReportResponse>(response).status).toBe('DISMISSED');
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).deletedAt).toBeNull();
  });

  it('actually removes the content when it is actioned', async () => {
    const { postId, reportId } = await reportedPost();

    await decide(reportId, { decision: 'ACTIONED' });

    // The claim the whole queue rests on. A verdict that changes nothing teaches a reviewer that
    // the button is decorative.
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).deletedAt).not.toBeNull();
  });

  it('takes the removed post out of everyone’s feed', async () => {
    const { postId, reportId } = await reportedPost();
    await db.follow.create({
      data: {
        followerAccountId: fixture.studentAccountId,
        followeeAccountId: fixture.teacherAccountId,
      },
    });

    await decide(reportId, { decision: 'ACTIONED' });

    const feed = await request(app)
      .get('/api/v1/feed')
      .set('Authorization', await asStudent());

    expect(bodyAs<{ data: { id: string }[] }>(feed).data.map((row) => row.id)).not.toContain(
      postId,
    );
  });

  it('records who decided, and their note', async () => {
    const { reportId } = await reportedPost();

    await decide(reportId, { decision: 'ACTIONED', note: 'Repeated abuse.' });

    const row = await db.report.findUniqueOrThrow({ where: { id: reportId } });
    expect(row.reviewedBy).toBe(fixture.platformAdminAccountId);
    expect(row.reviewedAt).not.toBeNull();

    const audit = await db.auditLog.findFirst({
      where: { entity: 'report', entityId: reportId },
    });
    // An unreviewable power over other people's words is not one this product should have.
    expect(audit?.actorAccountId).toBe(fixture.platformAdminAccountId);
    expect(JSON.stringify(audit?.metadata)).toContain('Repeated abuse.');
  });

  it('never shows the note to anybody else', async () => {
    const { reportId } = await reportedPost();
    await decide(reportId, { decision: 'DISMISSED', note: 'Internal reasoning.' });

    const mine = await request(app)
      .get('/api/v1/me/reports')
      .set('Authorization', await asStudent());

    expect(mine.text).not.toContain('Internal reasoning.');
  });

  it('refuses to action a report about an account', async () => {
    const report = bodyAs<{ id: string }>(
      await request(app)
        .post('/api/v1/reports')
        .set('Authorization', await asStudent())
        .send({
          subjectType: 'ACCOUNT',
          subjectId: fixture.teacherAccountId,
          reason: 'Impersonation.',
        }),
    );

    const response = await decide(report.id, { decision: 'ACTIONED' });

    // Suspending an account needs more than a queue button, and a reviewer must not be able to
    // believe they have dealt with something they have not.
    expect(response.status).toBe(422);
    expect((await db.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe('OPEN');
  });

  it('still lets an account report be dismissed or marked reviewed', async () => {
    const report = bodyAs<{ id: string }>(
      await request(app)
        .post('/api/v1/reports')
        .set('Authorization', await asStudent())
        .send({
          subjectType: 'ACCOUNT',
          subjectId: fixture.teacherAccountId,
          reason: 'Impersonation.',
        }),
    );

    expect((await decide(report.id, { decision: 'REVIEWED' })).status).toBe(200);
  });

  it('refuses the same decision twice', async () => {
    const { reportId } = await reportedPost();
    await decide(reportId, { decision: 'DISMISSED' });

    expect((await decide(reportId, { decision: 'DISMISSED' })).status).toBe(409);
  });

  it('lets a wrong dismissal be corrected', async () => {
    const { postId, reportId } = await reportedPost();
    await decide(reportId, { decision: 'DISMISSED' });

    // A dismissal that turns out to be wrong must be fixable; a queue that only moves one way
    // makes its reviewers cautious in exactly the wrong direction.
    expect((await decide(reportId, { decision: 'ACTIONED' })).status).toBe(200);
    expect((await db.post.findUniqueOrThrow({ where: { id: postId } })).deletedAt).not.toBeNull();
  });

  it('404s for a report that does not exist', async () => {
    expect((await decide(crypto.randomUUID(), { decision: 'DISMISSED' })).status).toBe(404);
  });

  it('refuses a decision nobody defined', async () => {
    const { reportId } = await reportedPost();

    expect((await decide(reportId, { decision: 'DELETE_EVERYTHING' })).status).toBe(422);
  });

  it('refuses a decision from anyone who is not staff', async () => {
    const { reportId } = await reportedPost();

    const response = await request(app)
      .post(`/api/v1/admin/reports/${reportId}/decision`)
      .set('Authorization', await auth(fixture.schoolAccountId, 'SCHOOL'))
      .send({ decision: 'DISMISSED' });

    expect(response.status).toBe(404);
  });
});
