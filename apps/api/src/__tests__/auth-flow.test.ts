/**
 * Auth flow integration tests (FR-AUTH-001..007), end to end through the real app and database.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { REFRESH_COOKIE } from '../modules/auth/auth.controller.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, testDb } from './support/db.js';
import { bodyAs, type ErrorBody } from './support/body.js';

import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;

interface SessionBody {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  refreshToken?: string;
}

interface MeBody {
  id: string;
  email: string;
  accountType: string;
  role: string | null;
  handle: string | null;
  schoolName: string | null;
}

const INDIVIDUAL = {
  email: 'Alice@Example.test',
  password: 'correct horse battery staple',
  fullName: 'Alice Fixture',
  handle: 'alice',
};

const SCHOOL = {
  email: 'school@example.test',
  password: 'correct horse battery staple',
  name: 'Example School',
};

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config: loadConfig() });
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
});

/** Registers an individual and returns the mobile-style session (refresh token in the body). */
async function registerIndividual(overrides: Partial<typeof INDIVIDUAL> = {}) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .set('X-Client-Type', 'mobile')
    .send({ ...INDIVIDUAL, ...overrides });

  return { response, body: bodyAs<SessionBody>(response) };
}

describe('POST /auth/register', () => {
  it('creates an account and returns a session', async () => {
    const { response, body } = await registerIndividual();

    expect(response.status).toBe(201);
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.tokenType).toBe('Bearer');
  });

  it('stores the password hashed with argon2id, never in plaintext', async () => {
    await registerIndividual();

    const credential = await db.credential.findFirst({
      select: { passwordHash: true, algo: true },
    });

    expect(credential?.algo).toBe('argon2id');
    expect(credential?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(credential?.passwordHash).not.toContain(INDIVIDUAL.password);
  });

  it('normalizes the email to lowercase so casing cannot create a second account', async () => {
    await registerIndividual();
    const { response } = await registerIndividual({
      email: 'ALICE@example.test',
      handle: 'alice2',
    });

    expect(response.status).toBe(409);
  });

  it('rejects a duplicate without revealing that the account exists', async () => {
    await registerIndividual();
    const { response, body } = await registerIndividual({ handle: 'other' });

    expect(response.status).toBe(409);
    expect(JSON.stringify(body)).not.toContain(INDIVIDUAL.email.toLowerCase());
  });

  it('rejects a weak password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...INDIVIDUAL, password: 'short' });

    expect(response.status).toBe(422);
    expect(bodyAs<ErrorBody>(response).error.details?.[0]?.field).toBe('password');
  });

  it('ignores a client-supplied role — privilege cannot be self-assigned', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({ ...INDIVIDUAL, role: 'PRINCIPAL', accountType: 'SCHOOL' });

    const profile = await db.userProfile.findFirst({ select: { role: true } });
    const account = await db.account.findFirst({ select: { type: true } });

    expect(profile?.role).toBe('USER');
    expect(account?.type).toBe('INDIVIDUAL');
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await registerIndividual();
  });

  it('returns a session for valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Type', 'mobile')
      .send({ email: INDIVIDUAL.email, password: INDIVIDUAL.password });

    expect(response.status).toBe(200);
    expect(bodyAs<SessionBody>(response).accessToken).toEqual(expect.any(String));
  });

  it('sets the refresh token as an httpOnly cookie for web clients, not in the body', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: INDIVIDUAL.email, password: INDIVIDUAL.password });

    const cookie = response.headers['set-cookie']?.[0] ?? '';

    expect(cookie).toContain(REFRESH_COOKIE);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(bodyAs<SessionBody>(response).refreshToken).toBeUndefined();
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: INDIVIDUAL.email, password: 'not the password' });

    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.test', password: INDIVIDUAL.password });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    // Identical bodies: anything else turns this endpoint into an account-existence oracle.
    expect(bodyAs<ErrorBody>(wrongPassword).error.message).toBe(
      bodyAs<ErrorBody>(unknownEmail).error.message,
    );
    expect(bodyAs<ErrorBody>(wrongPassword).error.code).toBe(
      bodyAs<ErrorBody>(unknownEmail).error.code,
    );
  });

  it('refuses a suspended account without saying so', async () => {
    await db.account.updateMany({ data: { status: 'SUSPENDED' } });

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: INDIVIDUAL.email, password: INDIVIDUAL.password });

    expect(response.status).toBe(401);
    expect(bodyAs<ErrorBody>(response).error.message).toBe('Email or password is incorrect.');
  });
});

describe('school accounts are web-only', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/auth/register/school').send(SCHOOL);
  });

  it('allows a school to log in from web', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Type', 'web')
      .send({ email: SCHOOL.email, password: SCHOOL.password });

    expect(response.status).toBe(200);
  });

  it('rejects a school logging in from mobile with SCHOOL_WEB_ONLY', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Type', 'mobile')
      .send({ email: SCHOOL.email, password: SCHOOL.password });

    expect(response.status).toBe(403);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('SCHOOL_WEB_ONLY');
  });

  it('rejects a school on mobile only after the password checks out', async () => {
    // A wrong password must still return 401, or the endpoint reveals which emails are schools.
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Type', 'mobile')
      .send({ email: SCHOOL.email, password: 'wrong password entirely' });

    expect(response.status).toBe(401);
    expect(bodyAs<ErrorBody>(response).error.code).toBe('UNAUTHENTICATED');
  });

  it('still allows an individual to log in from mobile', async () => {
    await registerIndividual();

    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client-Type', 'mobile')
      .send({ email: INDIVIDUAL.email, password: INDIVIDUAL.password });

    expect(response.status).toBe(200);
  });
});

describe('POST /auth/refresh', () => {
  async function mobileSession() {
    const { body } = await registerIndividual();
    return body.refreshToken as string;
  }

  it('rotates the refresh token', async () => {
    const first = await mobileSession();

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: first });

    expect(response.status).toBe(200);
    const second = bodyAs<SessionBody>(response).refreshToken;
    expect(second).toEqual(expect.any(String));
    expect(second).not.toBe(first);
  });

  it('rejects the previous token once rotated, and revokes the whole family', async () => {
    const first = await mobileSession();

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: first });
    const second = bodyAs<SessionBody>(rotated).refreshToken as string;

    // Replaying the consumed token: this is the theft signal.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: first });

    expect(replay.status).toBe(401);
    expect(bodyAs<ErrorBody>(replay).error.code).toBe('TOKEN_REUSE_DETECTED');

    // The thief's replay must also invalidate the legitimate client's current token.
    const afterRevocation = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: second });

    expect(afterRevocation.status).toBe(401);
  });

  it('rejects an unknown token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' });

    expect(response.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await mobileSession();
    await db.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token });

    expect(response.status).toBe(401);
  });

  it('stores only a hash of the refresh token', async () => {
    const token = await mobileSession();

    const stored = await db.refreshToken.findMany({ select: { tokenHash: true } });

    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).not.toBe(token);
    expect(stored[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session so the refresh token stops working', async () => {
    const { body } = await registerIndividual();
    const token = body.refreshToken as string;

    const logout = await request(app).post('/api/v1/auth/logout').send({ refreshToken: token });
    expect(logout.status).toBe(204);

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token });
    expect(refresh.status).toBe(401);
  });

  it('succeeds with no token — logout is idempotent', async () => {
    const response = await request(app).post('/api/v1/auth/logout').send({});

    expect(response.status).toBe(204);
  });
});

describe('GET /me', () => {
  it('returns the current account for a valid token', async () => {
    const { body } = await registerIndividual();

    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${body.accessToken}`);

    expect(response.status).toBe(200);
    expect(bodyAs<MeBody>(response)).toMatchObject({
      email: INDIVIDUAL.email.toLowerCase(),
      accountType: 'INDIVIDUAL',
      role: 'USER',
      handle: INDIVIDUAL.handle,
    });
  });

  it('never includes the password hash', async () => {
    const { body } = await registerIndividual();

    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${body.accessToken}`);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('argon2');
    expect(serialized).not.toContain('passwordHash');
  });

  it('rejects a missing token', async () => {
    const response = await request(app).get('/api/v1/me');

    expect(response.status).toBe(401);
  });

  it('rejects a malformed authorization header', async () => {
    const response = await request(app).get('/api/v1/me').set('Authorization', 'Basic abc123');

    expect(response.status).toBe(401);
  });

  it('rejects a tampered token', async () => {
    const { body } = await registerIndividual();
    const tampered = `${body.accessToken.slice(0, -4)}AAAA`;

    const response = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(response.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const { SignJWT } = await import('jose');
    const forged = await new SignJWT({ accountType: 'SCHOOL' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('11111111-1111-1111-1111-111111111111')
      .setIssuer('connected-api')
      .setAudience('connected-clients')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('an-attacker-chosen-secret-that-is-long'));

    const response = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${forged}`);

    expect(response.status).toBe(401);
  });
});
