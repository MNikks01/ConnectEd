/**
 * Failed-login backoff — FR-AUTH-011.
 *
 * The IP limiter in front of the auth routes stops one machine hammering the API. It does nothing
 * about **one account attacked from a thousand machines**, which is precisely what a
 * credential-stuffing list is for, and that gap is what this closes.
 *
 * Two properties matter more than the arithmetic:
 *
 * - **The throttle must not become an account-enumeration oracle.** It applies identically to
 *   addresses with no account, or an attacker learns which ones are registered by noticing which
 *   ones start refusing.
 * - **It is backoff, never lockout.** A block that does not lift is a denial of service against
 *   any account whose address somebody knows — and an address is the one part of a credential that
 *   is routinely public.
 */
import { createHash } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, testDb } from './support/db.js';

import type { Db } from '../shared/db/index.js';
import type { Express } from 'express';

let db: Db;
let app: Express;

const config = loadConfig();

const PASSWORD = 'Str0ng!Passw0rd';
const WRONG = 'Wr0ng!Passw0rd';

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

function uniqueEmail(): string {
  return `throttle-${crypto.randomUUID()}@fixture.test`;
}

const hashOf = (email: string) => createHash('sha256').update(email).digest('hex');

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

const login = (email: string, password: string) =>
  request(app).post('/api/v1/auth/login').send({ email, password });

/** Fails `times` times, and returns the last response. */
async function failLogin(email: string, times: number) {
  let last = await login(email, WRONG);
  for (let i = 1; i < times; i += 1) last = await login(email, WRONG);
  return last;
}

describe('backing off', () => {
  it('lets a few mistakes through untouched', async () => {
    const email = uniqueEmail();
    await register(email);

    // Four wrong attempts is a person with two keyboards' worth of muscle memory, not an attack.
    const response = await failLogin(email, 4);

    expect(response.status).toBe(401);
    expect((await login(email, PASSWORD)).status).toBe(200);
  });

  it('refuses the sixth attempt after five failures', async () => {
    const email = uniqueEmail();
    await register(email);

    await failLogin(email, 5);

    const response = await login(email, WRONG);
    expect(response.status).toBe(429);
  });

  it('refuses even the correct password while backing off', async () => {
    const email = uniqueEmail();
    await register(email);
    await failLogin(email, 5);

    // Deliberate. A throttle that steps aside for the right password is a throttle that does
    // nothing at all against the attack it exists for — guessing until one is right.
    expect((await login(email, PASSWORD)).status).toBe(429);
  });

  it('lifts when the backoff expires', async () => {
    const email = uniqueEmail();
    await register(email);
    await failLogin(email, 5);

    await db.loginThrottle.updateMany({ data: { blockedUntil: new Date(Date.now() - 1000) } });

    // Backoff, never lockout: a block that does not lift is a denial of service against anybody
    // whose address is known.
    expect((await login(email, PASSWORD)).status).toBe(200);
  });

  it('lengthens with each further failure', async () => {
    const email = uniqueEmail();
    await register(email);
    await failLogin(email, 5);

    const first = await db.loginThrottle.findUniqueOrThrow({ where: { emailHash: hashOf(email) } });

    // Expire it, fail once more, and the next block should be longer than the first.
    await db.loginThrottle.updateMany({ data: { blockedUntil: new Date(Date.now() - 1000) } });
    await login(email, WRONG);

    const second = await db.loginThrottle.findUniqueOrThrow({
      where: { emailHash: hashOf(email) },
    });

    const firstDelay = (first.blockedUntil?.getTime() ?? 0) - first.lastFailedAt.getTime();
    const secondDelay = (second.blockedUntil?.getTime() ?? 0) - second.lastFailedAt.getTime();
    expect(secondDelay).toBeGreaterThan(firstDelay);
  });

  it('forgets everything after a successful login', async () => {
    const email = uniqueEmail();
    await register(email);
    await failLogin(email, 4);

    expect((await login(email, PASSWORD)).status).toBe(200);

    // The counter is gone, so the next mistake starts from one rather than from five.
    expect(await db.loginThrottle.count({ where: { emailHash: hashOf(email) } })).toBe(0);
  });

  it('throttles one address without touching another', async () => {
    const attacked = uniqueEmail();
    const bystander = uniqueEmail();
    await register(attacked);
    await register(bystander);

    await failLogin(attacked, 5);

    // Otherwise the throttle is itself the denial of service.
    expect((await login(attacked, PASSWORD)).status).toBe(429);
    expect((await login(bystander, PASSWORD)).status).toBe(200);
  });
});

describe('what it must not reveal', () => {
  it('throttles an address with no account exactly the same way', async () => {
    const unknown = uniqueEmail();

    await failLogin(unknown, 5);
    const response = await login(unknown, WRONG);

    // The whole point. Throttling only real accounts would let an attacker enumerate addresses by
    // noticing which ones start refusing.
    expect(response.status).toBe(429);
  });

  it('answers a throttled unknown address identically to a throttled real one', async () => {
    const known = uniqueEmail();
    const unknown = uniqueEmail();
    await register(known);

    await failLogin(known, 5);
    await failLogin(unknown, 5);

    const a = await login(known, WRONG);
    const b = await login(unknown, WRONG);

    // Everything but the correlation id, which is per-request by design and carries nothing about
    // the account.
    const withoutCorrelation = (body: string) => body.replace(/"correlationId":"[^"]*"/, '');

    expect(a.status).toBe(b.status);
    expect(withoutCorrelation(a.text)).toBe(withoutCorrelation(b.text));
  });

  it('never stores the address itself', async () => {
    const email = uniqueEmail();
    await failLogin(email, 1);

    const rows = await db.loginThrottle.findMany();

    // This table would otherwise become a list of everyone who has ever mistyped a password here.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.emailHash).toBe(hashOf(email));
    expect(JSON.stringify(rows)).not.toContain(email);
  });
});

describe('housekeeping', () => {
  it('drops rows nobody is backing off any more', async () => {
    const { createAuthModule } = await import('../modules/auth/index.js');
    const { createPasswordHasher } = await import('../shared/auth/password.js');
    const { createTokenService } = await import('../shared/auth/tokens.js');
    const { createBillingModule } = await import('../modules/billing/index.js');
    const { createLogger } = await import('../shared/logger/index.js');

    const logger = createLogger({ ...config, LOG_LEVEL: 'silent' });
    const auth = createAuthModule({
      db,
      config,
      logger,
      passwords: createPasswordHasher(config),
      tokens: createTokenService(config),
      billing: createBillingModule(db, logger).service,
      mailer: { sendPasswordReset: () => Promise.resolve() },
    });

    const stale = uniqueEmail();
    const recent = uniqueEmail();
    await failLogin(stale, 1);
    await failLogin(recent, 1);

    await db.loginThrottle.updateMany({
      where: { emailHash: hashOf(stale) },
      data: { lastFailedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    expect(await auth.service.sweepLoginThrottles()).toBe(1);
    expect(await db.loginThrottle.count()).toBe(1);
  });
});
