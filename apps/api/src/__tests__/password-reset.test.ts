/**
 * Password reset — FR-AUTH-009.
 *
 * Until now somebody who forgot their password had no way back into their account at all. The
 * mechanics are the substance here and none of them wait on a mail transport being chosen:
 *
 * - **The response never depends on whether the address is registered.** This endpoint is
 *   unauthenticated and strangers will call it; anything that answers differently is a way to ask
 *   "does this person have an account here?", which for a product used by children is a question
 *   strangers should not be able to put to it.
 * - **The token is stored hashed**, like a refresh token. A database dump must not hand over live
 *   reset links.
 * - **Single use, and it revokes every session.** Somebody resetting a password may be doing it
 *   *because* someone else is in their account.
 */
import { createHash } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { Db } from '../shared/db/index.js';
import type { Mailer, PasswordResetEmail } from '../shared/mail/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let sent: PasswordResetEmail[];

const config = loadConfig();

/** Records instead of sending. The real transport is a decision nobody has made yet. */
const recordingMailer: Mailer = {
  sendPasswordReset: (message) => {
    sent.push(message);
    return Promise.resolve();
  },
};

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
  app = createApp({ db, config, mailer: recordingMailer });
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await resetDb();
  sent = [];
});

const PASSWORD = 'Str0ng!Passw0rd';
const NEW_PASSWORD = 'Ev3n!Str0nger';

async function register(email: string): Promise<void> {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      email,
      password: PASSWORD,
      fullName: 'A Person',
      handle: `person${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`,
    });

  expect(response.status, `setup: registration failed — ${response.text}`).toBe(201);
}

const forgot = (email: string) => request(app).post('/api/v1/auth/password/forgot').send({ email });

const reset = (token: string, password = NEW_PASSWORD) =>
  request(app).post('/api/v1/auth/password/reset').send({ token, password });

const login = (email: string, password: string) =>
  request(app).post('/api/v1/auth/login').send({ email, password });

function uniqueEmail(): string {
  return `reset-${crypto.randomUUID()}@fixture.test`;
}

describe('asking for a link', () => {
  it('sends one to a registered address', async () => {
    const email = uniqueEmail();
    await register(email);

    const response = await forgot(email);

    expect(response.status).toBe(202);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.expiresInMinutes).toBe(30);
  });

  it('answers identically for an address with no account', async () => {
    const registered = uniqueEmail();
    await register(registered);

    const known = await forgot(registered);
    const unknown = await forgot(uniqueEmail());

    // Same status, same empty body. Anything else is an account-enumeration oracle on an
    // unauthenticated endpoint.
    expect(unknown.status).toBe(known.status);
    expect(unknown.text).toBe(known.text);
    expect(sent).toHaveLength(1);
  });

  it('answers the same way when the mail cannot be sent', async () => {
    const email = uniqueEmail();
    await register(email);

    const failing = createApp({
      db,
      config,
      mailer: { sendPasswordReset: () => Promise.reject(new Error('no transport')) },
    });

    const response = await request(failing).post('/api/v1/auth/password/forgot').send({ email });

    // Loud in the logs, silent to the caller: telling them delivery failed would also tell a
    // stranger the address is real.
    expect(response.status).toBe(202);
  });

  it('never stores the token it sent', async () => {
    const email = uniqueEmail();
    await register(email);
    await forgot(email);

    const token = sent[0]?.token ?? '';
    const rows = await db.passwordResetToken.findMany();

    expect(token.length).toBeGreaterThan(20);
    expect(rows).toHaveLength(1);
    // Hashed, like a refresh token: a database dump must not hand over live reset links.
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('rejects something that is not an address', async () => {
    expect((await forgot('not-an-email')).status).toBe(422);
  });
});

describe('spending a link', () => {
  async function linkFor(email: string): Promise<string> {
    const response = await forgot(email);

    // The status is checked first, and it is not pedantry. This endpoint answers 202 to everything
    // — a registered address, an unknown one, a mail transport that is on fire — because anything
    // else is an account-enumeration oracle. So when the recorded email is missing, the reason is
    // invisible unless something looks: a 202 means the account was not found, and anything else
    // means the request failed outright. Observed once under load (S6-13) reporting only "no reset
    // email was recorded", which is the one thing that was never in question.
    expect(response.status, `setup: asking for a link failed — ${response.text}`).toBe(202);

    const token = sent.at(-1)?.token;
    expect(
      token,
      `setup: the request succeeded but no email was recorded, so the account for ${email} was not found`,
    ).toBeDefined();
    return token ?? '';
  }

  it('changes the password', async () => {
    const email = uniqueEmail();
    await register(email);

    const response = await reset(await linkFor(email));

    expect(response.status).toBe(204);
    expect((await login(email, NEW_PASSWORD)).status).toBe(200);
    expect((await login(email, PASSWORD)).status).toBe(401);
  });

  it('does not sign the user in', async () => {
    const email = uniqueEmail();
    await register(email);

    const response = await reset(await linkFor(email));

    // Convenient, and it would make a stolen link a stolen session. Logging in proves they know
    // the password they just set.
    expect(response.body).toEqual({});
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('revokes every existing session', async () => {
    const email = uniqueEmail();
    await register(email);

    const session = bodyAs<{ refreshToken?: string }>(
      await request(app)
        .post('/api/v1/auth/login')
        .set('X-Client-Type', 'mobile')
        .send({ email, password: PASSWORD }),
    );

    await reset(await linkFor(email));

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client-Type', 'mobile')
      .send({ refreshToken: session.refreshToken });

    // Somebody resetting a password may be doing it *because* someone else is in their account.
    expect(refreshed.status).toBe(401);
  });

  it('cannot be spent twice', async () => {
    const email = uniqueEmail();
    await register(email);
    const token = await linkFor(email);

    expect((await reset(token)).status).toBe(204);
    expect((await reset(token, 'Third!Passw0rd')).status).toBe(401);

    // And the second attempt changed nothing.
    expect((await login(email, NEW_PASSWORD)).status).toBe(200);
  });

  it('invalidates the links that were still outstanding', async () => {
    const email = uniqueEmail();
    await register(email);

    const first = await linkFor(email);
    const second = await linkFor(email);

    expect((await reset(second)).status).toBe(204);

    // An impatient second request, or a first one somebody intercepted — either way it dies with
    // the one that was used.
    expect((await reset(first, 'Third!Passw0rd')).status).toBe(401);
  });

  it('refuses an expired link', async () => {
    const email = uniqueEmail();
    await register(email);
    const token = await linkFor(email);

    await db.passwordResetToken.updateMany({
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await reset(token)).status).toBe(401);
    expect((await login(email, PASSWORD)).status).toBe(200);
  });

  it('refuses a token nobody issued', async () => {
    expect((await reset('completely-made-up')).status).toBe(401);
  });

  it('says the same thing for expired, spent, and invented', async () => {
    const email = uniqueEmail();
    await register(email);
    const token = await linkFor(email);
    await reset(token);

    const spent = await reset(token, 'Third!Passw0rd');
    const invented = await reset('never-issued', 'Third!Passw0rd');

    // Distinguishing them tells somebody holding a stolen link which part to work on.
    expect(spent.status).toBe(invented.status);
    expect(bodyAs<{ error: { message: string } }>(spent).error.message).toBe(
      bodyAs<{ error: { message: string } }>(invented).error.message,
    );
  });

  it('holds a new password to the same strength rules as registration', async () => {
    const email = uniqueEmail();
    await register(email);

    const response = await reset(await linkFor(email), 'short');

    // A reset flow with weaker rules than sign-up is a documented way to end up with weak
    // passwords: it is the path somebody takes when they are frustrated and in a hurry.
    expect(response.status).toBe(422);
  });

  it('never lets two requests race through one link', async () => {
    const email = uniqueEmail();
    await register(email);
    const token = await linkFor(email);

    const [a, b] = await Promise.all([
      reset(token, 'First!Passw0rd'),
      reset(token, 'Other!Pw0rd1'),
    ]);

    // Exactly one wins. The `where` on the update carries every condition, so only one statement
    // can match a row whose `usedAt` is still null.
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([204, 401]);
  });
});

describe('the console mailer', () => {
  it('refuses to exist in production', async () => {
    const { createConsoleMailer } = await import('../shared/mail/index.js');
    const logger = { warn: vi.fn(), error: vi.fn() };

    // It prints live reset tokens. A misconfigured environment variable must not be enough to
    // write credentials to a log aggregator.
    expect(() => createConsoleMailer(logger as never, 'production')).toThrow(
      /never run in production/,
    );
    expect(() => createConsoleMailer(logger as never, 'development')).not.toThrow();
  });
});
