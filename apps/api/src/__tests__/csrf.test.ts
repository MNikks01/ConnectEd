/**
 * Origin checking for cookie-authenticated writes.
 *
 * Raised by a CodeQL finding on this repository — `js/missing-token-validation`, high severity,
 * against the cookie middleware. The finding was arguably a false positive: the refresh cookie is
 * `httpOnly` and `SameSite=Strict`, and every other route authorizes from an `Authorization`
 * header a cross-site page cannot set. But "arguably a false positive" is a weak thing to write
 * next to a high-severity alert on a product used by children, and the honest response was to add
 * the control rather than to argue about it.
 *
 * What the tests pin down is the *scope*: this must catch a cross-origin write that presents the
 * cookie, and must not break a mobile client that sends no `Origin` at all and never had a cookie.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { REFRESH_COOKIE } from '../modules/auth/auth.controller.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;

const config = loadConfig();
const PASSWORD = 'Str0ng!Passw0rd';

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
});

/** Registers, then logs in as a browser would, and returns the refresh cookie. */
async function browserSession(): Promise<string> {
  const email = `csrf-${crypto.randomUUID()}@fixture.test`;

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: PASSWORD,
      fullName: 'A Person',
      handle: `person${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`,
    });

  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', config.WEB_ORIGIN)
    .send({ email, password: PASSWORD });

  const cookies = login.headers['set-cookie'] as unknown as string[] | undefined;
  const refresh = cookies?.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE}=`));

  expect(refresh, 'setup: no refresh cookie was set').toBeDefined();
  return refresh ?? '';
}

describe('a write that presents the refresh cookie', () => {
  it('is allowed from the application’s own origin', async () => {
    const cookie = await browserSession();

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', config.WEB_ORIGIN)
      .set('Cookie', cookie)
      .send({});

    expect(response.status).toBe(200);
  });

  it('is refused from somewhere else', async () => {
    const cookie = await browserSession();

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .send({});

    // `SameSite=Strict` should already have stopped the browser sending the cookie. This is the
    // layer for the browser that does not enforce it, and for the compromised subdomain that is
    // same-*site* but not same-*origin*.
    expect(response.status).toBe(403);
  });

  it('is refused with no origin at all', async () => {
    const cookie = await browserSession();

    const response = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({});

    // A browser always sends `Origin` on a write. Its absence on a cookie-bearing one is a
    // non-browser client replaying a cookie it should not have.
    expect(response.status).toBe(403);
  });

  it('leaves reads alone', async () => {
    const cookie = await browserSession();

    const response = await request(app)
      .get('/api/v1/me')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie);

    // A GET is not a state change, and refusing one would break every ordinary page load that
    // happens to carry the cookie.
    expect(response.status).toBe(401);
  });
});

describe('what it must not break', () => {
  it('lets a mobile client through with no origin and no cookie', async () => {
    const email = `mobile-${crypto.randomUUID()}@fixture.test`;

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({
        email,
        password: PASSWORD,
        fullName: 'A Person',
        handle: `mobile${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`,
      });

    expect(registered.status).toBe(201);

    const session = bodyAs<{ refreshToken?: string }>(registered);

    // No cookie, no `Origin`, and a refresh token in the body — the shape a phone actually sends.
    // A control aimed at browsers must not reach it.
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: session.refreshToken });

    expect(refreshed.status).toBe(200);
  });

  it('leaves an unauthenticated write alone', async () => {
    // `/rum` takes browser measurements from any page, has no cookie, and stores nothing.
    const response = await request(app)
      .post('/api/v1/rum')
      .send({ vitals: [{ name: 'LCP', value: 100, path: '/home' }] });

    expect(response.status).toBe(204);
  });

  it('leaves a bearer-authorized write alone', async () => {
    const email = `bearer-${crypto.randomUUID()}@fixture.test`;

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client-Type', 'mobile')
      .send({
        email,
        password: PASSWORD,
        fullName: 'A Person',
        handle: `bearer${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`,
      });

    const { accessToken } = bodyAs<{ accessToken: string }>(registered);

    const response = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ body: 'A header a cross-site page cannot set.' });

    // These were never reachable this way: setting `Authorization` cross-origin needs a preflight
    // the CORS policy refuses.
    expect(response.status).toBe(201);
  });
});
