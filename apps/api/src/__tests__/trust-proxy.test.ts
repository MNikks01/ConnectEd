/**
 * How much of `X-Forwarded-For` the API believes — `.docs/Security/05-review-2026-08-05.md`,
 * finding 2.
 *
 * `app.set('trust proxy', true)` was set once, in the first week, with a comment about load
 * balancers. It means `req.ip` is taken from a header the client writes. Every IP-keyed limit in
 * the product — login, registration, password reset, `/rum` — then keys on a value the caller
 * chooses, so a fresh bucket is one header away and the limit is decoration.
 *
 * These tests are behavioural rather than about the setting, because the setting is not the point:
 * what matters is whether ten attempts from one machine still count as ten. The second test asserts
 * the *broken* behaviour under `true`, which is the only way to know the first test would have
 * caught the thing it exists to catch.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, testDb } from './support/db.js';

import type { Config } from '../shared/config/index.js';
import type { Db } from '../shared/db/index.js';

let db: Db;
const base = loadConfig();

beforeAll(async () => {
  db = testDb();
  await assertDbReachable();
});

/** The limiter is off for the suite at large; these tests are the reason it can be turned on. */
function appTrusting(trustProxy: Config['TRUST_PROXY']) {
  return createApp({ db, config: { ...base, TRUST_PROXY: trustProxy, RATE_LIMIT_ENABLED: true } });
}

/**
 * Eleven login attempts, each claiming to come from a different address. The limiter allows ten
 * in fifteen minutes.
 */
async function attemptsFromSpoofedAddresses(
  app: ReturnType<typeof appTrusting>,
): Promise<number[]> {
  const statuses: number[] = [];

  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', `203.0.113.${String(attempt + 1)}`)
      .send({ email: `nobody-${String(attempt)}@fixture.test`, password: 'wrong-password-here' });

    statuses.push(response.status);
  }

  return statuses;
}

describe('rate limiting when nothing is in front of the API', () => {
  it('counts spoofed addresses as one caller', async () => {
    const statuses = await attemptsFromSpoofedAddresses(appTrusting(false));

    // The point of the whole change: eleven attempts from one machine are eleven attempts,
    // whatever the request claims about where it came from.
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
    expect(statuses.at(-1)).toBe(429);
  });

  it('is what the old setting gave away', async () => {
    const statuses = await attemptsFromSpoofedAddresses(appTrusting(true));

    // Not an aspiration — a demonstration. Under `true` every spoofed address gets its own
    // bucket, so the limiter never fires, and no test in the suite would have noticed.
    expect(statuses).not.toContain(429);
  });

  it('still limits a caller who sends no forwarding header at all', async () => {
    const app = appTrusting(false);
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@fixture.test', password: 'wrong-password-here' });
      statuses.push(response.status);
    }

    expect(statuses.at(-1)).toBe(429);
  });
});

describe('what the setting will accept', () => {
  const parse = (value: string | undefined) => {
    const previous = process.env.TRUST_PROXY;
    if (value === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = value;

    try {
      return loadConfig().TRUST_PROXY;
    } finally {
      if (previous === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previous;
    }
  };

  it('trusts nothing when nobody said otherwise', () => {
    // The default is the safe end, so a deployment that forgets gets a limiter that is too strict
    // rather than one that has quietly stopped working.
    expect(parse(undefined)).toBe(false);
  });

  it('takes a hop count', () => {
    expect(parse('1')).toBe(1);
    expect(parse('2')).toBe(2);
  });

  it('takes addresses and ranges', () => {
    expect(parse('10.0.0.0/8')).toBe('10.0.0.0/8');
    expect(parse('loopback, 172.16.0.0/12')).toBe('loopback,172.16.0.0/12');
  });

  it('takes true, because some deployments really do overwrite the header', () => {
    expect(parse('true')).toBe(true);
  });

  it('refuses a value nobody meant', () => {
    // A typo here fails open, which is precisely the failure this whole change is about — so it
    // fails at boot instead, where somebody is watching.
    expect(() => parse('yes')).toThrow();
    expect(() => parse('1 proxy')).toThrow();
    expect(() => parse('')).toThrow();
  });
});
