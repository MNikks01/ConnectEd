/**
 * Two-factor authentication — FR-AUTH-012.
 *
 * Offered to the accounts whose compromise reaches children's data: the school account, which
 * holds the contract and the verification queue, and the principal.
 *
 * The TOTP implementation is checked against **RFC 6238's own published test vectors** rather than
 * against another library's behaviour. That is the reason it could be written rather than
 * depended on: a second factor is a poor place to add supply-chain surface for forty lines, and
 * the specification came with the answers.
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createSecretBox } from '../shared/auth/secret-box.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { base32Encode, hotp, totp, verifyTotp } from '../shared/auth/totp.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, seedSchool, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { SchoolFixture } from './support/db.js';
import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;
let fixture: SchoolFixture;

const TWO_FACTOR_KEY = 'a-test-only-key-that-is-long-enough-32';
const config = { ...loadConfig(), TWO_FACTOR_KEY };
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

const asSchool = () => auth(fixture.schoolAccountId, 'SCHOOL');
const asPrincipal = () => auth(fixture.principalAccountId, 'INDIVIDUAL', 'PRINCIPAL');
const asStudent = () => auth(fixture.studentAccountId, 'INDIVIDUAL', 'STUDENT');

/** Enrols an account and returns its secret and recovery codes. */
async function enrol(authorization: string) {
  const started = await request(app).post('/api/v1/me/2fa').set('Authorization', authorization);
  expect(started.status, `enrol failed — ${started.text}`).toBe(201);

  const { secret } = bodyAs<{ secret: string; otpauthUri: string }>(started);

  const confirmed = await request(app)
    .post('/api/v1/me/2fa/confirm')
    .set('Authorization', authorization)
    .send({ code: totp(secret) });

  expect(confirmed.status, `confirm failed — ${confirmed.text}`).toBe(200);

  return { secret, recoveryCodes: bodyAs<{ recoveryCodes: string[] }>(confirmed).recoveryCodes };
}

describe('the TOTP implementation', () => {
  /**
   * RFC 6238, Appendix B. The shared secret is the ASCII string "12345678901234567890"; these are
   * the codes it must produce at the listed times.
   */
  const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches the RFC vector at t=%i', (seconds, expected) => {
    expect(totp(RFC_SECRET, new Date(seconds * 1000))).toBe(expected);
  });

  it('matches the RFC 4226 HOTP vectors too', () => {
    const secret = Buffer.from('12345678901234567890');
    expect(hotp(secret, 0)).toBe('755224');
    expect(hotp(secret, 1)).toBe('287082');
    expect(hotp(secret, 9)).toBe('520489');
  });

  it('accepts the step either side of now', () => {
    const secret = base32Encode(Buffer.from('a-secret-of-some-length'));
    const now = new Date();

    // Ninety seconds. Zero drift would reject a code typed four seconds too late, which is most
    // of them.
    expect(verifyTotp(secret, totp(secret, new Date(now.getTime() - 30_000)), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, new Date(now.getTime() + 30_000)), now)).toBe(true);
    expect(verifyTotp(secret, totp(secret, new Date(now.getTime() - 120_000)), now)).toBe(false);
  });

  it('refuses anything that is not six digits', () => {
    const secret = base32Encode(Buffer.from('a-secret-of-some-length'));

    expect(verifyTotp(secret, '12345')).toBe(false);
    expect(verifyTotp(secret, 'abcdef')).toBe(false);
    expect(verifyTotp(secret, '')).toBe(false);
  });
});

describe('the secret box', () => {
  it('round-trips', () => {
    const box = createSecretBox(TWO_FACTOR_KEY);
    expect(box.open(box.seal('JBSWY3DPEHPK3PXP'))).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produces a different ciphertext each time', () => {
    const box = createSecretBox(TWO_FACTOR_KEY);
    // A reused IV under GCM leaks the XOR of the plaintexts and forges the tag.
    expect(box.seal('same')).not.toBe(box.seal('same'));
  });

  it('refuses a tampered value rather than decrypting rubbish', () => {
    const box = createSecretBox(TWO_FACTOR_KEY);
    const [iv, tag, ciphertext] = box.seal('JBSWY3DPEHPK3PXP').split(':');

    expect(() =>
      box.open(`${iv ?? ''}:${tag ?? ''}:${(ciphertext ?? '').slice(0, -2)}AA`),
    ).toThrow();
  });

  it('refuses the wrong key', () => {
    const sealed = createSecretBox(TWO_FACTOR_KEY).seal('JBSWY3DPEHPK3PXP');
    expect(() => createSecretBox('a-different-key-also-long-enough-32').open(sealed)).toThrow();
  });
});

describe('who may enrol', () => {
  it('lets a school account', async () => {
    const response = await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());
    expect(response.status).toBe(201);
  });

  it('lets a principal', async () => {
    const response = await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asPrincipal());
    expect(response.status).toBe(201);
  });

  it('refuses a student', async () => {
    const response = await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asStudent());

    // Every enrolled account is one more person who can be locked out by a lost phone. Offering
    // it where it buys little is how a support burden is created.
    expect(response.status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    expect((await request(app).post('/api/v1/me/2fa')).status).toBe(401);
  });

  it('is unavailable when no key is configured', async () => {
    const withoutKey = createApp({ db, config: { ...config, TWO_FACTOR_KEY: undefined } });

    const response = await request(withoutKey)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());

    // Rather than storing a second factor in the clear.
    expect(response.status).toBe(503);
  });
});

describe('enrolling', () => {
  it('does not take effect until a code confirms it', async () => {
    const started = await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());
    expect(started.status).toBe(201);

    const row = await db.twoFactorSecret.findUniqueOrThrow({
      where: { accountId: fixture.schoolAccountId },
    });

    // An enrolment trusted before a first correct code locks people out of their own accounts
    // when the QR scan silently failed.
    expect(row.confirmedAt).toBeNull();
  });

  it('encrypts the secret at rest', async () => {
    const started = await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());
    const { secret } = bodyAs<{ secret: string }>(started);

    const row = await db.twoFactorSecret.findUniqueOrThrow({
      where: { accountId: fixture.schoolAccountId },
    });

    // A dump containing this in the clear turns two-factor authentication back into one.
    expect(row.secret).not.toContain(secret);
    expect(createSecretBox(TWO_FACTOR_KEY).open(row.secret)).toBe(secret);
  });

  it('refuses to confirm with a wrong code', async () => {
    await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());

    const response = await request(app)
      .post('/api/v1/me/2fa/confirm')
      .set('Authorization', await asSchool())
      .send({ code: '000000' });

    expect(response.status).toBe(401);
    const row = await db.twoFactorSecret.findUniqueOrThrow({
      where: { accountId: fixture.schoolAccountId },
    });
    expect(row.confirmedAt).toBeNull();
  });

  it('issues ten recovery codes, once, and stores them hashed', async () => {
    const { recoveryCodes } = await enrol(await asSchool());

    expect(recoveryCodes).toHaveLength(10);

    const stored = await db.recoveryCode.findMany({
      where: { accountId: fixture.schoolAccountId },
    });
    expect(stored).toHaveLength(10);
    // The response is the only place they ever exist in readable form.
    expect(stored.map((row) => row.codeHash)).not.toContain(recoveryCodes[0]);
  });

  it('discards a previous unconfirmed enrolment rather than stacking one', async () => {
    await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());
    const second = await request(app)
      .post('/api/v1/me/2fa')
      .set('Authorization', await asSchool());

    const { secret } = bodyAs<{ secret: string }>(second);
    const confirmed = await request(app)
      .post('/api/v1/me/2fa/confirm')
      .set('Authorization', await asSchool())
      .send({ code: totp(secret) });

    // Re-enrolling before confirming is a retry, not a second factor.
    expect(confirmed.status).toBe(200);
    expect(await db.twoFactorSecret.count({ where: { accountId: fixture.schoolAccountId } })).toBe(
      1,
    );
  });
});

describe('signing in with it', () => {
  const PASSWORD = 'Str0ng!Passw0rd';

  /** A fresh individual who is a principal, so they may enrol, and who can actually log in. */
  async function principalWithPassword() {
    const email = `principal-${crypto.randomUUID()}@fixture.test`;

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email,
        password: PASSWORD,
        fullName: 'A Principal',
        handle: `principal${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`,
      });

    const account = await db.account.findUniqueOrThrow({ where: { email }, select: { id: true } });
    await db.userProfile.update({ where: { accountId: account.id }, data: { role: 'PRINCIPAL' } });

    const authorization = await auth(account.id, 'INDIVIDUAL', 'PRINCIPAL');
    const { secret, recoveryCodes } = await enrol(authorization);

    return { email, accountId: account.id, secret, recoveryCodes };
  }

  const login = (email: string, password = PASSWORD) =>
    request(app).post('/api/v1/auth/login').send({ email, password });

  it('asks for a code instead of handing over a session', async () => {
    const { email } = await principalWithPassword();

    const response = await login(email);

    // 200, not 401: the credentials *were* accepted, and a 401 would tell a client to re-prompt
    // for a password, which is the wrong thing to ask for next.
    expect(response.status).toBe(200);
    expect(bodyAs<{ twoFactorRequired: boolean }>(response).twoFactorRequired).toBe(true);
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('completes with a correct code', async () => {
    const { email, secret } = await principalWithPassword();
    const challenge = bodyAs<{ challengeToken: string }>(await login(email));

    const response = await request(app)
      .post('/api/v1/auth/login/2fa')
      .set('X-Client-Type', 'mobile')
      .send({ challengeToken: challenge.challengeToken, code: totp(secret) });

    expect(response.status).toBe(200);
    expect(bodyAs<{ accessToken?: string }>(response).accessToken).toBeDefined();
  });

  it('refuses a wrong code', async () => {
    const { email } = await principalWithPassword();
    const challenge = bodyAs<{ challengeToken: string }>(await login(email));

    const response = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ challengeToken: challenge.challengeToken, code: '000000' });

    expect(response.status).toBe(401);
  });

  it('spends the challenge whether or not the code was right', async () => {
    const { email, secret } = await principalWithPassword();
    const challenge = bodyAs<{ challengeToken: string }>(await login(email));

    await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ challengeToken: challenge.challengeToken, code: '000000' });

    // Otherwise a stolen challenge is an unlimited number of guesses at six digits.
    const second = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ challengeToken: challenge.challengeToken, code: totp(secret) });

    expect(second.status).toBe(401);
  });

  it('refuses an expired challenge', async () => {
    const { email, secret } = await principalWithPassword();
    const challenge = bodyAs<{ challengeToken: string }>(await login(email));

    await db.twoFactorChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const response = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ challengeToken: challenge.challengeToken, code: totp(secret) });

    expect(response.status).toBe(401);
  });

  it('accepts a recovery code, once', async () => {
    const { email, recoveryCodes } = await principalWithPassword();
    const code = recoveryCodes[0] ?? '';

    const first = bodyAs<{ challengeToken: string }>(await login(email));
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login/2fa')
          .set('X-Client-Type', 'mobile')
          .send({ challengeToken: first.challengeToken, code })
      ).status,
    ).toBe(200);

    const second = bodyAs<{ challengeToken: string }>(await login(email));
    const reused = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ challengeToken: second.challengeToken, code });

    expect(reused.status).toBe(401);
  });

  it('still refuses a wrong password before asking for anything', async () => {
    const { email } = await principalWithPassword();

    const response = await login(email, 'Wr0ng!Passw0rd');

    // The second factor is a second factor, not a replacement for the first.
    expect(response.status).toBe(401);
    expect(response.text).not.toContain('twoFactorRequired');
  });

  it('re-checks the account between the two legs', async () => {
    const { email, accountId, secret } = await principalWithPassword();
    const challenge = bodyAs<{ challengeToken: string }>(await login(email));

    await db.account.update({ where: { id: accountId }, data: { status: 'SUSPENDED' } });

    const response = await request(app)
      .post('/api/v1/auth/login/2fa')
      .send({ challengeToken: challenge.challengeToken, code: totp(secret) });

    // Five minutes is long enough for somebody to be suspended in.
    expect(response.status).toBe(401);
  });
});

describe('turning it off', () => {
  it('needs a current code, not merely a session', async () => {
    await enrol(await asSchool());

    const response = await request(app)
      .delete('/api/v1/me/2fa')
      .set('Authorization', await asSchool())
      .send({ code: '000000' });

    // Otherwise a borrowed laptop removes the factor that exists to make a borrowed laptop
    // insufficient.
    expect(response.status).toBe(401);
    expect(await db.twoFactorSecret.count()).toBe(1);
  });

  it('works with a correct code', async () => {
    const { secret } = await enrol(await asSchool());

    const response = await request(app)
      .delete('/api/v1/me/2fa')
      .set('Authorization', await asSchool())
      .send({ code: totp(secret) });

    expect(response.status).toBe(204);
    expect(await db.twoFactorSecret.count()).toBe(0);
    // The codes go with the secret they belong to.
    expect(await db.recoveryCode.count()).toBe(0);
  });

  it('404s when there was nothing to turn off', async () => {
    const response = await request(app)
      .delete('/api/v1/me/2fa')
      .set('Authorization', await asSchool())
      .send({ code: '000000' });

    expect(response.status).toBe(404);
  });
});
