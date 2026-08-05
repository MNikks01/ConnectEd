/**
 * Notification preferences — FR-NOTIF-006.
 *
 * The dispatcher has honoured these since S2: `deliver` checks `isCategoryEnabled` before writing
 * anything. **Nothing could set them.** The endpoint catalogue listed `PATCH /me/notification-prefs`
 * and no such route existed, so the product had a preference system nobody could reach — which is
 * indistinguishable, from a user's chair, from not having one.
 *
 * The decision worth reviewing is which categories are *not* switchable.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { createNotificationsModule } from '../modules/notifications/index.js';
import { createVerificationModule } from '../modules/verification/index.js';
import { createBillingModule } from '../modules/billing/index.js';
import { createLogger } from '../shared/logger/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { NotificationPrefResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);
const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });

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

async function auth(accountId: string, role = 'STUDENT') {
  const token = await tokens.signAccessToken({
    sub: accountId,
    accountType: 'INDIVIDUAL',
    role: role as never,
  });
  return `Bearer ${token}`;
}

const asStudent = () => auth(fixture.studentAccountId);

const readPrefs = async () =>
  request(app)
    .get('/api/v1/me/notification-prefs')
    .set('Authorization', await asStudent());

const setPrefs = async (preferences: { category: string; enabled: boolean }[]) =>
  request(app)
    .patch('/api/v1/me/notification-prefs')
    .set('Authorization', await asStudent())
    .send({ preferences });

/** The dispatcher, wired as the worker wires it. */
function notifications() {
  const verification = createVerificationModule(
    db,
    logger,
    { publish: () => Promise.resolve() },
    createBillingModule(db, logger).service,
  );
  return createNotificationsModule(db, logger, verification.service);
}

describe('reading them', () => {
  it('returns every switchable category, set or not', async () => {
    const body = bodyAs<{ data: NotificationPrefResponse[] }>(await readPrefs());

    // A settings page renders what it is given; missing switches for the categories nobody has
    // touched would be a page that grows as you use it.
    expect(body.data.map((row) => row.category).sort()).toEqual([
      'ACADEMIC',
      'EVENT',
      'LEAVE',
      'MESSAGE',
      'NOTICE',
      'SOCIAL',
    ]);
    expect(body.data.every((row) => row.enabled)).toBe(true);
  });

  it('never offers verification or billing', async () => {
    const body = bodyAs<{ data: NotificationPrefResponse[] }>(await readPrefs());
    const categories = body.data.map((row) => row.category);

    // A student who asked to join a school has to be told the answer, and this is the only
    // channel. An opt-out there is not a preference, it is a way to never hear back.
    expect(categories).not.toContain('VERIFICATION');
    expect(categories).not.toContain('BILLING');
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await request(app).get('/api/v1/me/notification-prefs')).status).toBe(401);
  });
});

describe('setting them', () => {
  it('switches one off', async () => {
    const response = await setPrefs([{ category: 'SOCIAL', enabled: false }]);

    expect(response.status).toBe(200);
    const social = bodyAs<{ data: NotificationPrefResponse[] }>(response).data.find(
      (row) => row.category === 'SOCIAL',
    );
    expect(social?.enabled).toBe(false);
  });

  it('leaves the categories it did not mention alone', async () => {
    await setPrefs([{ category: 'SOCIAL', enabled: false }]);
    await setPrefs([{ category: 'MESSAGE', enabled: false }]);

    const body = bodyAs<{ data: NotificationPrefResponse[] }>(await readPrefs());

    // A partial update that silently re-enabled everything else would be a settings page that
    // undoes your last change every time you make a new one.
    expect(body.data.find((row) => row.category === 'SOCIAL')?.enabled).toBe(false);
    expect(body.data.find((row) => row.category === 'MESSAGE')?.enabled).toBe(false);
    expect(body.data.find((row) => row.category === 'ACADEMIC')?.enabled).toBe(true);
  });

  it('switches one back on', async () => {
    await setPrefs([{ category: 'SOCIAL', enabled: false }]);
    await setPrefs([{ category: 'SOCIAL', enabled: true }]);

    const body = bodyAs<{ data: NotificationPrefResponse[] }>(await readPrefs());
    expect(body.data.find((row) => row.category === 'SOCIAL')?.enabled).toBe(true);
  });

  it('refuses a category nobody may switch off', async () => {
    const response = await setPrefs([{ category: 'VERIFICATION', enabled: false }]);

    // Enforced by the schema rather than by a check in the handler: the set of switchable
    // categories is one list, and the type system holds everything to it.
    expect(response.status).toBe(422);
  });

  it('refuses a category that does not exist', async () => {
    expect((await setPrefs([{ category: 'INVENTED', enabled: false }])).status).toBe(422);
  });

  it('refuses an empty change', async () => {
    expect((await setPrefs([])).status).toBe(422);
  });

  it('keeps one account’s choices out of another’s', async () => {
    await setPrefs([{ category: 'SOCIAL', enabled: false }]);

    const other = await request(app)
      .get('/api/v1/me/notification-prefs')
      .set('Authorization', await auth(fixture.teacherAccountId, 'TEACHER'));

    expect(
      bodyAs<{ data: NotificationPrefResponse[] }>(other).data.find(
        (row) => row.category === 'SOCIAL',
      )?.enabled,
    ).toBe(true);
  });
});

describe('the dispatcher honours them', () => {
  it('writes nothing for a category that is switched off', async () => {
    await setPrefs([{ category: 'ACADEMIC', enabled: false }]);

    await notifications().service.handleEvent({
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      type: 'academic.published',
      itemId: crypto.randomUUID(),
      classId: fixture.classAId,
      itemType: 'HOMEWORK',
      title: 'Read chapter four',
      authorAccountId: fixture.teacherAccountId,
    });

    // The half that already worked, asserted now that something can actually set the preference.
    expect(
      await db.notification.count({ where: { recipientAccountId: fixture.studentAccountId } }),
    ).toBe(0);
  });

  it('still writes for everybody who has not switched it off', async () => {
    await setPrefs([{ category: 'ACADEMIC', enabled: false }]);

    await notifications().service.handleEvent({
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      type: 'academic.published',
      itemId: crypto.randomUUID(),
      classId: fixture.classAId,
      itemType: 'HOMEWORK',
      title: 'Read chapter four',
      authorAccountId: fixture.teacherAccountId,
    });

    // One person's preference is one person's. The parent of a child in class A still hears.
    const others = await db.notification.count({
      where: { recipientAccountId: { not: fixture.studentAccountId } },
    });
    expect(others).toBeGreaterThan(0);
  });

  it('still delivers a verification decision to someone who muted everything else', async () => {
    await setPrefs([
      { category: 'ACADEMIC', enabled: false },
      { category: 'NOTICE', enabled: false },
      { category: 'EVENT', enabled: false },
      { category: 'LEAVE', enabled: false },
      { category: 'SOCIAL', enabled: false },
      { category: 'MESSAGE', enabled: false },
    ]);

    await notifications().service.handleEvent({
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      type: 'verification.decided',
      requestId: crypto.randomUUID(),
      requesterAccountId: fixture.studentAccountId,
      schoolId: fixture.schoolAccountId,
      role: 'STUDENT',
      status: 'VERIFIED',
    });

    // The whole reason verification is not switchable.
    expect(
      await db.notification.count({ where: { recipientAccountId: fixture.studentAccountId } }),
    ).toBe(1);
  });
});
