/**
 * Export and erasure — S9-19 (FR-DSR-001 … 032, ADR-0020).
 *
 * Most of this suite is about what is **not** in a file and what is **still** in a database, which
 * is an unusual shape for a test suite and is the whole reason this one is long.
 *
 * Three claims would make the feature actively harmful if they broke, and each has a test whose
 * failure is unambiguous:
 *
 * 1. **A bundle contains no authentication material and nobody else's data** (FR-DSR-010/011). A
 *    leak here is not a bug report, it is a disclosure — so the assertions are made against the
 *    serialised JSON as a string, not against the object graph. A password hash reachable through
 *    a nested relation is exactly the kind of thing an object-shaped assertion walks straight past.
 * 2. **Erasure does not take the school's records with it** (FR-DSR-024). The register, the marks
 *    and the report card of an erased pupil survive; the pupil does not.
 *  3. **An erased account cannot be signed into or found** (FR-DSR-026).
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createPrivacyModule } from '../modules/privacy/index.js';
import { createPasswordHasher } from '../shared/auth/password.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs, type ErrorBody } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Storage } from '../shared/storage/index.js';
import type { PrivacyService } from '../modules/privacy/index.js';
import type {
  DataExportBundle,
  DataExportDownloadResponse,
  DataExportResponse,
  ErasureRequestResponse,
  PrivacyStatusResponse,
} from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;
let privacy: PrivacyService;

/** Key → body, so a test can read what was actually written to the bucket. */
let bucket: Map<string, Buffer>;

const config = loadConfig();
const tokens = createTokenService(config);
const passwords = createPasswordHasher(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

/** The seeded fixture accounts have no credential; a sign-in test needs a real one. */
const PASSWORD = 'Sup3rSecret!pass';

async function givePassword(accountId: string): Promise<void> {
  await db.credential.create({
    data: { accountId, passwordHash: await passwords.hash(PASSWORD), algo: passwords.algo },
  });
}

function fakeStorage(): Storage {
  return {
    putImage: ({ body, contentType }) => {
      const key = `images/${bucket.size}.bin`;
      bucket.set(key, body);
      return Promise.resolve({ key, contentType, size: body.length });
    },
    putObject: ({ key, body }) => {
      bucket.set(key, body);
      return Promise.resolve({ key, size: body.length });
    },
    signedUrl: (key) => Promise.resolve(`https://signed.test/${key}?sig=x`),
    signedUrlTtlSeconds: 300,
    remove: (key) => {
      bucket.delete(key);
      return Promise.resolve();
    },
    ping: () => Promise.resolve(),
    ensureBucket: () => Promise.resolve(),
  };
}

async function auth(accountId: string, kind: 'INDIVIDUAL' | 'SCHOOL', role?: string) {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: kind,
    ...(role ? { role: role as never } : {}),
  });
  return `Bearer ${token}`;
}

const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asParent = () => auth(fixture.parentAccountId, 'INDIVIDUAL', 'PARENT');
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL', 'SCHOOL');

/** Request, then run the builder the worker runs. Returns the finished row. */
async function requestAndBuild(header: string): Promise<DataExportResponse> {
  const requested = await request(app)
    .post('/api/v1/me/exports')
    .set('Authorization', header)
    .expect(202);

  await privacy.buildPendingExports();

  const list = await request(app)
    .get('/api/v1/me/exports')
    .set('Authorization', header)
    .expect(200);

  const rows = bodyAs<{ data: DataExportResponse[] }>(list).data;
  const row = rows.find((candidate) => candidate.id === bodyAs<DataExportResponse>(requested).id);

  expect(row).toBeDefined();
  return row as DataExportResponse;
}

async function bundleFor(header: string): Promise<{ bundle: DataExportBundle; raw: string }> {
  const row = await requestAndBuild(header);
  expect(row.status).toBe('READY');

  const download = await request(app)
    .post(`/api/v1/me/exports/${row.id}/download`)
    .set('Authorization', header)
    .expect(200);

  const key = bodyAs<DataExportDownloadResponse>(download)
    .url.split('/')
    .slice(3)
    .join('/')
    .split('?')[0];
  const body = bucket.get(key as string);

  expect(body, `no object at ${String(key)}`).toBeDefined();

  const raw = (body as Buffer).toString('utf8');
  return { bundle: JSON.parse(raw) as DataExportBundle, raw };
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  fixture = await seedSchool(db);

  bucket = new Map();
  const storage = fakeStorage();

  app = createApp({ config, logger, db, storage });
  privacy = createPrivacyModule({
    db,
    logger,
    storage,
    hashEmail: tokens.hashRefreshToken,
  }).service;
});

describe('export', () => {
  it('is requested, built off the request path, and downloaded by its owner', async () => {
    const row = await requestAndBuild(await asStudent());

    expect(row.status).toBe('READY');
    expect(row.sizeBytes).toBeGreaterThan(0);
    expect(row.expiresAt).not.toBeNull();

    const download = await request(app)
      .post(`/api/v1/me/exports/${row.id}/download`)
      .set('Authorization', await asStudent())
      .expect(200);

    expect(bodyAs<DataExportDownloadResponse>(download).url).toContain('https://signed.test/');

    // Counted, so eleven downloads of one bundle is something somebody could notice (FR-DSR-006).
    const after = await request(app)
      .get('/api/v1/me/exports')
      .set('Authorization', await asStudent())
      .expect(200);

    expect(bodyAs<{ data: DataExportResponse[] }>(after).data[0]?.downloads).toBe(1);

    const audit = await db.auditLog.findFirst({ where: { action: 'privacy.export.downloaded' } });
    expect(audit?.entityId).toBe(row.id);
  });

  it('refuses a second request while one is outstanding', async () => {
    await request(app)
      .post('/api/v1/me/exports')
      .set('Authorization', await asStudent())
      .expect(202);

    const second = await request(app)
      .post('/api/v1/me/exports')
      .set('Authorization', await asStudent())
      .expect(409);

    expect(bodyAs<ErrorBody>(second).error.message).toMatch(/already being prepared/i);
  });

  it('contains the pupil’s own academic record', async () => {
    const assessment = await db.assessment.create({
      data: {
        subjectId: fixture.mathsSubjectId,
        classId: fixture.classAId,
        kind: 'TEST',
        title: 'Fractions',
        maxScore: '20',
        occurredOn: new Date('2026-08-01'),
        authorAccountId: fixture.teacherAccountId,
        publishedAt: new Date(),
      },
    });

    await db.mark.create({
      data: {
        assessmentId: assessment.id,
        studentAccountId: fixture.studentAccountId,
        score: '17.50',
        remark: 'Good work',
        staffNote: 'Struggled with the last question',
      },
    });

    await db.attendanceEntry.create({
      data: {
        classId: fixture.classAId,
        studentAccountId: fixture.studentAccountId,
        onDate: new Date('2026-08-03'),
        state: 'PRESENT',
        takenByAccountId: fixture.teacherAccountId,
      },
    });

    const { bundle } = await bundleFor(await asStudent());

    expect(bundle.manifest.schemaVersion).toBe(1);
    expect(bundle.manifest.counts.marks).toBe(1);
    expect(bundle.manifest.counts.attendance).toBe(1);

    const [mark] = bundle.sections.marks as { score: string; staffNote: string }[];

    // A string, not a float: 17.50 out of 20 is a mark, and a float is a rounding error waiting
    // for a regulator.
    expect(mark?.score).toBe('17.5');

    // The staff note is in it, deliberately. The schema says of that column in as many words that
    // "a subject access request still reaches it" — private-from-the-family is a rule about the
    // product's screens, not about what it may be made to disclose about somebody.
    expect(mark?.staffNote).toBe('Struggled with the last question');
  });

  it('names every section, including the empty ones', async () => {
    const { bundle } = await bundleFor(await asOutsider());

    // An account that has done nothing still gets a full manifest. An absent section and an empty
    // one read identically to a person and mean very different things (FR-DSR-013).
    expect(Object.keys(bundle.sections)).toContain('reportCards');
    expect(bundle.manifest.counts.reportCards).toBe(0);
    expect(bundle.sections.reportCards).toEqual([]);
  });

  it('contains no authentication material', async () => {
    await givePassword(fixture.studentAccountId);

    const credential = await db.credential.findUniqueOrThrow({
      where: { accountId: fixture.studentAccountId },
    });

    const { raw } = await bundleFor(await asStudent());

    // Asserted against the serialised file rather than the parsed object: a hash reachable through
    // a nested relation is exactly what an object-shaped assertion walks past (FR-DSR-010).
    expect(raw).not.toContain(credential.passwordHash);
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('tokenHash');
  });

  it('contains the subject’s messages and not the other party’s', async () => {
    const thread = await db.messageThread.create({
      data: { participantA: fixture.studentAccountId, participantB: fixture.parentAccountId },
    });

    await db.message.create({
      data: {
        threadId: thread.id,
        senderAccountId: fixture.studentAccountId,
        body: 'MINE-forgot my kit',
      },
    });
    await db.message.create({
      data: {
        threadId: thread.id,
        senderAccountId: fixture.parentAccountId,
        body: 'THEIRS-I will bring it',
      },
    });

    const { raw, bundle } = await bundleFor(await asStudent());

    expect(bundle.manifest.counts.messagesSent).toBe(1);
    expect(raw).toContain('MINE-forgot my kit');
    // The counterparty wrote that to one person, not to that person's export file (FR-DSR-011).
    expect(raw).not.toContain('THEIRS-I will bring it');
  });

  it('gives a school its own record and none of its pupils’ marks', async () => {
    const assessment = await db.assessment.create({
      data: {
        subjectId: fixture.mathsSubjectId,
        classId: fixture.classAId,
        kind: 'TEST',
        title: 'Fractions',
        maxScore: '20',
        occurredOn: new Date('2026-08-01'),
        authorAccountId: fixture.teacherAccountId,
        publishedAt: new Date(),
      },
    });

    await db.mark.create({
      data: {
        assessmentId: assessment.id,
        studentAccountId: fixture.studentAccountId,
        score: '17.50',
        remark: 'PUPIL-REMARK-DO-NOT-EXPORT',
      },
    });

    const { bundle, raw } = await bundleFor(await asSchool());

    expect(Object.keys(bundle.sections)).toContain('classes');
    expect(Object.keys(bundle.sections)).not.toContain('marks');
    // The failure this feature could most plausibly produce: "the school's data" quietly meaning
    // four hundred children's marks (FR-DSR-012).
    expect(raw).not.toContain('PUPIL-REMARK-DO-NOT-EXPORT');
  });

  it('is not reachable by anybody but its owner', async () => {
    const row = await requestAndBuild(await asStudent());

    // 404 rather than 403: whether a given export exists is not something another account may
    // confirm by asking (`.docs/API/01-conventions.md`).
    await request(app)
      .post(`/api/v1/me/exports/${row.id}/download`)
      .set('Authorization', await asParent())
      .expect(404);

    await request(app).post(`/api/v1/me/exports/${row.id}/download`).expect(401);
  });

  it('expires, and the object goes with it', async () => {
    const row = await requestAndBuild(await asStudent());

    await db.dataExport.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(bucket.size).toBe(1);

    await privacy.expireExports();

    // The bundle concentrates in one object what the rest of the product keeps behind fifty
    // separate authorization checks; an object that lives forever is one misconfiguration away
    // from being the worst single file in the system (FR-DSR-005).
    expect(bucket.size).toBe(0);

    const after = await db.dataExport.findUniqueOrThrow({ where: { id: row.id } });
    expect(after.status).toBe('EXPIRED');
    expect(after.objectKey).toBeNull();

    const download = await request(app)
      .post(`/api/v1/me/exports/${row.id}/download`)
      .set('Authorization', await asStudent())
      .expect(409);

    expect(bodyAs<ErrorBody>(download).error.message).toMatch(/expired/i);
  });

  it('reclaims a build a dead worker left behind', async () => {
    await request(app)
      .post('/api/v1/me/exports')
      .set('Authorization', await asStudent())
      .expect(202);

    // A process that died mid-build. Without reclaim the owner's only symptom is a screen that
    // says "being prepared" and always will.
    await db.dataExport.updateMany({
      data: { status: 'BUILDING', startedAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    await privacy.buildPendingExports();

    const row = await db.dataExport.findFirstOrThrow({});
    expect(row.status).toBe('READY');
  });
});

describe('erasure', () => {
  async function scheduleErasure(header: string): Promise<ErasureRequestResponse> {
    const response = await request(app)
      .post('/api/v1/me/erasure')
      .send({ confirm: 'ERASE' })
      .set('Authorization', header)
      .expect(202);

    return bodyAs<ErasureRequestResponse>(response);
  }

  /** Backdate and run the job the worker runs nightly. */
  async function executeNow(): Promise<void> {
    await db.erasureRequest.updateMany({
      data: { scheduledFor: new Date(Date.now() - 1000) },
    });
    await privacy.executeDueErasures();
  }

  it('is scheduled rather than performed, and can be cancelled', async () => {
    const scheduled = await scheduleErasure(await asStudent());

    const days =
      (new Date(scheduled.scheduledFor).getTime() - new Date(scheduled.requestedAt).getTime()) /
      (24 * 60 * 60 * 1000);

    // The commonest reason to press this button is a bad afternoon (FR-DSR-021).
    expect(Math.round(days)).toBe(30);

    // And the account still works during the grace period — suspending immediately would punish
    // the change of mind the grace period exists for (FR-DSR-023).
    const status = await request(app)
      .get('/api/v1/me/privacy')
      .set('Authorization', await asStudent())
      .expect(200);

    expect(bodyAs<PrivacyStatusResponse>(status).pendingErasure?.id).toBe(scheduled.id);

    await request(app)
      .delete('/api/v1/me/erasure')
      .set('Authorization', await asStudent())
      .expect(204);

    await request(app)
      .delete('/api/v1/me/erasure')
      .set('Authorization', await asStudent())
      .expect(404);

    await executeNow();

    const account = await db.account.findUniqueOrThrow({ where: { id: fixture.studentAccountId } });
    expect(account.status).toBe('ACTIVE');
  });

  it('refuses a school, and says why', async () => {
    const refused = await request(app)
      .post('/api/v1/me/erasure')
      .send({ confirm: 'ERASE' })
      .set('Authorization', await asSchool())
      .expect(403);

    // Explained rather than merely refused: a school reading "forbidden" would reasonably conclude
    // the product had lost the feature, when its situation is different in kind (FR-DSR-020).
    expect(bodyAs<ErrorBody>(refused).error.message).toMatch(/records belong to its pupils/i);

    const status = await request(app)
      .get('/api/v1/me/privacy')
      .set('Authorization', await asSchool())
      .expect(200);

    expect(bodyAs<PrivacyStatusResponse>(status).mayErase).toBe(false);
  });

  it('refuses a second request while one is pending', async () => {
    await scheduleErasure(await asStudent());

    await request(app)
      .post('/api/v1/me/erasure')
      .send({ confirm: 'ERASE' })
      .set('Authorization', await asStudent())
      .expect(409);
  });

  it('requires the confirmation word', async () => {
    // A speed bump, not a security control — but the last screen before the one irreversible
    // action in the product should not be a single click.
    await request(app)
      .post('/api/v1/me/erasure')
      .send({})
      .set('Authorization', await asStudent())
      .expect(422);
  });

  it('blocks an export request, so no bundle outlives its subject', async () => {
    await scheduleErasure(await asStudent());

    const refused = await request(app)
      .post('/api/v1/me/exports')
      .set('Authorization', await asStudent())
      .expect(409);

    expect(bodyAs<ErrorBody>(refused).error.message).toMatch(/scheduled for erasure/i);
  });

  it('deletes the person and leaves the school’s records standing', async () => {
    const assessment = await db.assessment.create({
      data: {
        subjectId: fixture.mathsSubjectId,
        classId: fixture.classAId,
        kind: 'TEST',
        title: 'Fractions',
        maxScore: '20',
        occurredOn: new Date('2026-08-01'),
        authorAccountId: fixture.teacherAccountId,
        publishedAt: new Date(),
      },
    });

    await db.mark.create({
      data: {
        assessmentId: assessment.id,
        studentAccountId: fixture.studentAccountId,
        score: '17.50',
      },
    });

    await db.attendanceEntry.create({
      data: {
        classId: fixture.classAId,
        studentAccountId: fixture.studentAccountId,
        onDate: new Date('2026-08-03'),
        state: 'PRESENT',
        takenByAccountId: fixture.teacherAccountId,
      },
    });

    await db.post.create({
      data: { authorAccountId: fixture.studentAccountId, body: 'a post of mine' },
    });

    await scheduleErasure(await asStudent());
    await executeNow();

    const account = await db.account.findUniqueOrThrow({ where: { id: fixture.studentAccountId } });

    // The tombstone: the row survives so the school's records can still point at it, and holds no
    // personal data (ADR-0020).
    expect(account.status).toBe('ERASED');
    expect(account.email).toMatch(/@erased\.invalid$/);
    expect(account.deletedAt).not.toBeNull();

    expect(await db.userProfile.findUnique({ where: { accountId: account.id } })).toBeNull();
    expect(await db.credential.findUnique({ where: { accountId: account.id } })).toBeNull();
    expect(await db.post.count({ where: { authorAccountId: account.id } })).toBe(0);

    // The half that would be a catastrophe: a pupil exercising a right they unambiguously have
    // must not take a term of the school's register with them (FR-DSR-024).
    expect(await db.mark.count({ where: { studentAccountId: account.id } })).toBe(1);
    expect(await db.attendanceEntry.count({ where: { studentAccountId: account.id } })).toBe(1);

    // The school keeps its record that somebody held a place; REVOKED is the state every fan-out
    // and roster already excludes (FR-DSR-031).
    const memberships = await db.membership.findMany({ where: { accountId: account.id } });
    expect(memberships.length).toBeGreaterThan(0);
    expect(memberships.every((row) => row.status === 'REVOKED')).toBe(true);

    // The audit outlives its subject, and its counts are what make "we erased this" checkable.
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: 'account.erased' } });
    expect((audit.metadata as { counts: Record<string, number> }).counts.userProfile).toBe(1);
  });

  it('leaves the counterparty’s messages alone', async () => {
    const thread = await db.messageThread.create({
      data: { participantA: fixture.studentAccountId, participantB: fixture.parentAccountId },
    });

    await db.message.create({
      data: { threadId: thread.id, senderAccountId: fixture.studentAccountId, body: 'mine' },
    });
    await db.message.create({
      data: { threadId: thread.id, senderAccountId: fixture.parentAccountId, body: 'theirs' },
    });

    await scheduleErasure(await asStudent());
    await executeNow();

    const remaining = await db.message.findMany({ where: { threadId: thread.id } });

    // Their words are theirs — written by them, about them, and theirs to keep. The thread stays,
    // showing "A former member" on one side (FR-DSR-030).
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.body).toBe('theirs');
    expect(await db.messageThread.findUnique({ where: { id: thread.id } })).not.toBeNull();
  });

  it('releases the teacher’s class so the class is not left stranded', async () => {
    // FR-DSR-032. A class teacher who erases themself must not leave a class with a class teacher
    // nobody can contact or replace.
    expect(await db.classTeacher.count({ where: { teacherId: fixture.teacherProfileId } })).toBe(1);

    await scheduleErasure(await auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER'));
    await executeNow();

    expect(await db.teacherProfile.count({ where: { accountId: fixture.teacherAccountId } })).toBe(
      0,
    );
    expect(await db.classTeacher.count({ where: { teacherId: fixture.teacherProfileId } })).toBe(0);
    expect(
      await db.subjectAllocation.count({ where: { teacherId: fixture.teacherProfileId } }),
    ).toBe(0);

    // The homework they set is the class's, and stays — pointing at a tombstone.
    const klass = await db.class.findUnique({ where: { id: fixture.classAId } });
    expect(klass).not.toBeNull();
  });

  it('cannot be signed into afterwards, and releases the address', async () => {
    await givePassword(fixture.studentAccountId);

    const before = await db.account.findUniqueOrThrow({
      where: { id: fixture.studentAccountId },
      select: { email: true },
    });

    // Proved *before* the erasure, so "login fails afterwards" cannot pass for the trivial reason
    // that it never worked. That is the shape of test this repo has been caught by before.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: before.email, password: PASSWORD })
      .expect(200);

    await scheduleErasure(await asStudent());
    await executeNow();

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: before.email, password: PASSWORD });

    expect(login.status).toBeGreaterThanOrEqual(400);

    // The address is free again: the person may register and get a genuinely new account. An
    // erasure that also banned the address would be a punishment rather than a right.
    const taken = await db.account.findUnique({ where: { email: before.email } });
    expect(taken).toBeNull();
  });

  it('erasing a parent does not erase their child’s record', async () => {
    await db.attendanceEntry.create({
      data: {
        classId: fixture.classAId,
        studentAccountId: fixture.studentAccountId,
        onDate: new Date('2026-08-03'),
        state: 'PRESENT',
        takenByAccountId: fixture.teacherAccountId,
      },
    });

    await scheduleErasure(await asParent());
    await executeNow();

    // The parent's own record of their child goes with them; the pupil's account and the school's
    // record of that pupil are a different subject entirely.
    expect(await db.child.count({ where: { parentAccountId: fixture.parentAccountId } })).toBe(0);

    const pupil = await db.account.findUniqueOrThrow({ where: { id: fixture.studentAccountId } });
    expect(pupil.status).toBe('ACTIVE');
    expect(await db.attendanceEntry.count({ where: { studentAccountId: pupil.id } })).toBe(1);
  });
});
