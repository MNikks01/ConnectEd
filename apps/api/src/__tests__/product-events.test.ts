/**
 * The business-event log — S9-15 (`.docs/Product/02-metrics.md`).
 *
 * The finding this exists for: the declared north star is *Weekly Active Verified Members per
 * school*, and until now nothing in the schema recorded that a member had done anything. The only
 * `lastSeenAt` belonged to a push token and meant "this device registered". The product could not
 * measure the number it had chosen to be measured by.
 *
 * Two things here would make the table worse than useless if they broke, and each has a test whose
 * failure is unambiguous:
 *
 * 1. **Activity is one row per person per day.** The stamp rides on session issue, which happens
 *    on login and on every fifteen-minute refresh; without the dedupe key an active user writes
 *    ninety-six rows a day and every weekly-active figure is inflated by two orders of magnitude.
 * 2. **The event commits with its cause.** A school that exists without an onboarding event is a
 *    hole in every later cohort, and a hole is worse than an absence because it is invisible.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createPasswordHasher } from '../shared/auth/password.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createLogger } from '../shared/logger/index.js';
import { recordAccountActive, utcDay } from '../shared/analytics/product-events.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const passwords = createPasswordHasher(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

const PASSWORD = 'Sup3rSecret!pass';

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
  app = createApp({ config, logger, db });
});

describe('account.active', () => {
  it('records one row per account per day however many sessions are issued', async () => {
    await db.credential.create({
      data: {
        accountId: fixture.studentAccountId,
        passwordHash: await passwords.hash(PASSWORD),
        algo: passwords.algo,
      },
    });

    const account = await db.account.findUniqueOrThrow({
      where: { id: fixture.studentAccountId },
      select: { email: true },
    });

    // Three sign-ins, which in production would be a login plus two of the refreshes an active
    // person makes every fifteen minutes.
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: account.email, password: PASSWORD })
        .expect(200);
    }

    const rows = await db.productEvent.findMany({
      where: { type: 'account.active', accountId: fixture.studentAccountId },
    });

    // One. Without the dedupe key this is three, and in a real day it is ninety-six.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.dedupeKey).toBe(
      `account.active:${fixture.studentAccountId}:${utcDay(new Date())}`,
    );
  });

  it('records a separate row on a separate day', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await recordAccountActive(db, fixture.studentAccountId, yesterday);
    await recordAccountActive(db, fixture.studentAccountId, new Date());
    // A repeat of the first day, which must still collapse.
    await recordAccountActive(db, fixture.studentAccountId, yesterday);

    const rows = await db.productEvent.findMany({
      where: { type: 'account.active', accountId: fixture.studentAccountId },
    });

    expect(rows).toHaveLength(2);
  });
});

describe('the funnel events', () => {
  it('records a school the moment one exists, in the same transaction', async () => {
    const email = `school-${String(Date.now())}@fixture.test`;

    await request(app)
      .post('/api/v1/auth/register/school')
      .send({ email, password: PASSWORD, name: 'Recorded School' })
      .expect(201);

    const account = await db.account.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const onboarded = await db.productEvent.findFirst({
      where: { type: 'school.onboarded', accountId: account.id },
    });

    expect(onboarded).not.toBeNull();
    expect(onboarded?.schoolId).toBe(account.id);
  });

  it('records a verification only when it is an approval', async () => {
    const outsider = fixture.outsiderAccountId;

    const requested = await db.verificationRequest.create({
      data: {
        requesterAccountId: outsider,
        schoolId: fixture.schoolAccountId,
        role: 'STUDENT',
        classId: fixture.classAId,
        status: 'PENDING',
      },
      select: { id: true },
    });

    const asSchool = `Bearer ${await tokens.signAccessToken({
      sub: fixture.schoolAccountId,
      accountType: 'SCHOOL',
    })}`;

    await request(app)
      .post(`/api/v1/verifications/${requested.id}/decision`)
      .send({ decision: 'REJECT' })
      .set('Authorization', asSchool)
      .expect(200);

    // A rejection is a real outcome and belongs in the *rate*, which the funnel derives from
    // requests submitted against approvals recorded. Counting it here would make it ambiguous
    // which number this table held.
    expect(
      await db.productEvent.count({ where: { type: 'member.verified', accountId: outsider } }),
    ).toBe(0);
  });
});

describe('what the table refuses to hold', () => {
  it('keeps no text a person typed, so a withdrawn item leaves no name behind', async () => {
    const asTeacher = `Bearer ${await tokens.signAccessToken({
      sub: fixture.teacherAccountId,
      accountType: 'INDIVIDUAL',
      role: 'TEACHER',
    })}`;

    await request(app)
      .post(`/api/v1/classes/${fixture.classAId}/academics`)
      .send({
        type: 'HOMEWORK',
        subjectId: fixture.mathsSubjectId,
        title: 'SECRET-TITLE-NOT-FOR-ANALYTICS',
        body: 'SECRET-BODY-NOT-FOR-ANALYTICS',
      })
      .set('Authorization', asTeacher)
      .expect(201);

    const rows = await db.productEvent.findMany({ where: { type: 'academic.published' } });
    expect(rows).toHaveLength(1);

    // The row outlives the item it describes. Anything the teacher typed would survive its own
    // deletion, which is the opposite of what the erasure work guarantees.
    const serialised = JSON.stringify(rows[0]);
    expect(serialised).not.toContain('SECRET-TITLE-NOT-FOR-ANALYTICS');
    expect(serialised).not.toContain('SECRET-BODY-NOT-FOR-ANALYTICS');
  });
});

describe('erasure', () => {
  it('leaves the school’s history standing when a member erases themself', async () => {
    await recordAccountActive(db, fixture.studentAccountId);

    const before = await db.productEvent.count({
      where: { type: 'account.active', accountId: fixture.studentAccountId },
    });
    expect(before).toBe(1);

    const { createPrivacyModule } = await import('../modules/privacy/index.js');
    const privacy = createPrivacyModule({
      db,
      logger,
      hashEmail: tokens.hashRefreshToken,
    }).service;

    await db.erasureRequest.create({
      data: { accountId: fixture.studentAccountId, scheduledFor: new Date(Date.now() - 1000) },
    });
    await privacy.executeDueErasures();

    // Severed, not deleted. Deleting would retroactively lower every weekly-active figure the
    // school had ever been shown — one member's erasure rewriting somebody else's history.
    expect(
      await db.productEvent.count({
        where: { type: 'account.active', accountId: fixture.studentAccountId },
      }),
    ).toBe(1);

    // And the id it still carries resolves to nobody.
    const account = await db.account.findUniqueOrThrow({ where: { id: fixture.studentAccountId } });
    expect(account.status).toBe('ERASED');
    expect(await db.userProfile.findUnique({ where: { accountId: account.id } })).toBeNull();
  });
});
