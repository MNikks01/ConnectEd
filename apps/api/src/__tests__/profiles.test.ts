/**
 * Profiles — S4-1 (FR-SOC-001).
 *
 * The first module with **no verification gate**, which makes the positive cases the unusual ones:
 * an account with no membership anywhere can read a profile, and that is the requirement rather
 * than a missing check. What is enforced instead is ownership — you edit yours and nobody else's —
 * and the visibility setting, which hides everything except the card a stranger needs to find you.
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
import type { Storage } from '../shared/storage/index.js';
import type { ProfileResponse } from '@connected/types';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const config = loadConfig();
const tokens = createTokenService(config);

function fakeStorage(): Storage {
  return {
    putImage: ({ body, contentType, prefix }) =>
      Promise.resolve({ key: `${prefix}/x.bin`, contentType, size: body.length }),
    signedUrl: (key) => Promise.resolve(`https://signed.test/${key}`),
    remove: () => Promise.resolve(),
    ping: () => Promise.resolve(),
    ensureBucket: () => Promise.resolve(),
  };
}

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config, storage: fakeStorage() });
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

const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');
const asTeacher = () => auth(fixture.teacherAccountId, 'INDIVIDUAL', 'TEACHER');
const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
/** Verified nowhere. In every other module this account is refused everything. */
const asOutsider = () => auth(fixture.outsiderAccountId, 'INDIVIDUAL', 'USER');

async function connect(a: string, b: string): Promise<void> {
  await db.connection.create({
    data: { aAccountId: a, bAccountId: b, status: 'ACCEPTED', requestedBy: a },
  });
}

describe('GET /accounts/:id/profile — reading', () => {
  it('lets an account with no membership anywhere read a profile', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asOutsider());

    // Social is open to everyone (PRD 06). This passing is the requirement, not a gap.
    expect(response.status).toBe(200);
    expect(bodyAs<ProfileResponse>(response).restricted).toBe(false);
  });

  it('still requires a session', async () => {
    const response = await request(app).get(`/api/v1/accounts/${fixture.studentAccountId}/profile`);

    expect(response.status).toBe(401);
  });

  it('returns a school profile too', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.schoolAccountId}/profile`)
      .set('Authorization', await asStudent());

    expect(bodyAs<ProfileResponse>(response)).toMatchObject({
      accountType: 'SCHOOL',
      displayName: 'Fixture School',
      restricted: false,
    });
  });

  it('answers 404 for an account that does not exist', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${crypto.randomUUID()}/profile`)
      .set('Authorization', await asStudent());

    expect(response.status).toBe(404);
  });

  it('signs the display picture only when there is one', async () => {
    await db.userProfile.update({
      where: { accountId: fixture.studentAccountId },
      data: { displayPicKey: 'avatars/student.png' },
    });

    const withPicture = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asOutsider());
    const without = await request(app)
      .get(`/api/v1/accounts/${fixture.teacherAccountId}/profile`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<ProfileResponse>(withPicture).displayPicUrl).toContain('https://signed.test/');
    expect(bodyAs<ProfileResponse>(without).displayPicUrl).toBeNull();
  });
});

describe('visibility', () => {
  beforeEach(async () => {
    await db.userProfile.update({
      where: { accountId: fixture.studentAccountId },
      data: { visibility: 'CONNECTIONS', bio: 'Plays the cello.', achievements: 'Grade 5' },
    });
  });

  it('shows a stranger the card and nothing else', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asOutsider());

    const profile = bodyAs<ProfileResponse>(response);

    // Enough to recognise them and ask to connect — a profile nobody can find is a profile nobody
    // can connect with.
    expect(profile.displayName).toBeTruthy();
    expect(profile.restricted).toBe(true);
    expect(profile.bio).toBeUndefined();
    expect(profile.achievements).toBeUndefined();
  });

  it('shows a connected account everything', async () => {
    await connect(fixture.outsiderAccountId, fixture.studentAccountId);

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<ProfileResponse>(response)).toMatchObject({
      restricted: false,
      bio: 'Plays the cello.',
    });
  });

  it('ignores a connection that is still pending', async () => {
    await db.connection.create({
      data: {
        aAccountId: fixture.outsiderAccountId,
        bAccountId: fixture.studentAccountId,
        status: 'PENDING',
        requestedBy: fixture.outsiderAccountId,
      },
    });

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<ProfileResponse>(response).restricted).toBe(true);
  });

  it('reads a connection in either direction', async () => {
    // Stored as one row per pair; who asked is recorded but does not decide who may see.
    await connect(fixture.studentAccountId, fixture.outsiderAccountId);

    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<ProfileResponse>(response).restricted).toBe(false);
  });

  it('always shows you your own', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asStudent());

    expect(bodyAs<ProfileResponse>(response)).toMatchObject({
      restricted: false,
      visibility: 'CONNECTIONS',
    });
  });

  it('never tells anyone else what your setting is', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.studentAccountId}/profile`)
      .set('Authorization', await asTeacher());

    // "This person is connections-only" is itself a fact about them.
    expect(bodyAs<ProfileResponse>(response).visibility).toBeUndefined();
  });

  it('does not restrict a school', async () => {
    const response = await request(app)
      .get(`/api/v1/accounts/${fixture.schoolAccountId}/profile`)
      .set('Authorization', await asOutsider());

    expect(bodyAs<ProfileResponse>(response).restricted).toBe(false);
  });
});

describe('PATCH /me/profile — editing', () => {
  it('lets the owner change their own', async () => {
    const response = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asStudent())
      .send({ bio: 'Plays the cello.', visibility: 'CONNECTIONS' });

    expect(response.status).toBe(200);
    expect(bodyAs<ProfileResponse>(response)).toMatchObject({
      bio: 'Plays the cello.',
      visibility: 'CONNECTIONS',
    });
  });

  it('clears a field with null rather than ignoring it', async () => {
    await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asStudent())
      .send({ bio: 'Temporary.' });

    const response = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asStudent())
      .send({ bio: null });

    expect(bodyAs<ProfileResponse>(response).bio).toBeNull();
  });

  it('touches only the caller’s profile', async () => {
    await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asStudent())
      .send({ bio: 'Mine.' });

    const teacher = await db.userProfile.findUnique({
      where: { accountId: fixture.teacherAccountId },
    });

    // There is no path that takes someone else's id, which is the point of scoping by the token.
    expect(teacher?.bio).toBeNull();
  });

  it('rejects a bio longer than the limit', async () => {
    const response = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asStudent())
      .send({ bio: 'x'.repeat(1001) });

    expect(response.status).toBe(422);
  });

  it('rejects an unknown visibility', async () => {
    const response = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asStudent())
      .send({ visibility: 'FRIENDS_OF_FRIENDS' });

    expect(response.status).toBe(422);
  });

  it('sends a school to the portal instead of writing two ways into one row', async () => {
    const response = await request(app)
      .patch('/api/v1/me/profile')
      .set('Authorization', await asSchool())
      .send({ bio: 'We are a school.' });

    expect(response.status).toBe(404);
  });

  it('requires a session', async () => {
    const response = await request(app).patch('/api/v1/me/profile').send({ bio: 'Anonymous.' });

    expect(response.status).toBe(401);
  });
});

describe('GET /me/profile', () => {
  it('returns the caller’s own, unrestricted, with the setting', async () => {
    await db.userProfile.update({
      where: { accountId: fixture.studentAccountId },
      data: { visibility: 'CONNECTIONS', bio: 'Mine to see.' },
    });

    const response = await request(app)
      .get('/api/v1/me/profile')
      .set('Authorization', await asStudent());

    expect(bodyAs<ProfileResponse>(response)).toMatchObject({
      restricted: false,
      bio: 'Mine to see.',
      visibility: 'CONNECTIONS',
    });
  });
});
