/**
 * Asymmetric access-token signing — S3-10 (ADR-0014).
 *
 * The point of the change is that a verifier no longer needs the signing key. These tests hold
 * that line: a token signed with one key is refused by another, the published JWKS contains only
 * public material, and a token from the previous key still verifies through a rotation while
 * nothing new is signed with it.
 */
import { generateKeyPair, exportPKCS8, exportSPKI, decodeProtectedHeader } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { createTokenService } from '../shared/auth/tokens.js';
import { loadConfig } from '../shared/config/index.js';
import { assertDbReachable, closeTestDb, resetDb, testDb } from './support/db.js';
import { bodyAs } from './support/body.js';

import type { Config } from '../shared/config/index.js';

interface Pem {
  privateKey: string;
  publicKey: string;
}

async function ed25519(): Promise<Pem> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', {
    crv: 'Ed25519',
    extractable: true,
  });

  return {
    privateKey: await exportPKCS8(privateKey),
    publicKey: await exportSPKI(publicKey),
  };
}

let primary: Pem;
let other: Pem;

const base = loadConfig();

/** A config with the given key material layered on, without touching the process environment. */
function withKeys(overrides: Partial<Config>): Config {
  return { ...base, ...overrides, jwtAsymmetric: Boolean(overrides.JWT_PRIVATE_KEY) };
}

beforeAll(async () => {
  [primary, other] = await Promise.all([ed25519(), ed25519()]);
});

describe('EdDSA signing', () => {
  it('signs and verifies a round trip', async () => {
    const tokens = createTokenService(
      withKeys({ JWT_PRIVATE_KEY: primary.privateKey, JWT_PUBLIC_KEY: primary.publicKey }),
    );

    const token = await tokens.signAccessToken({ sub: 'abc', accountType: 'INDIVIDUAL' });

    expect(await tokens.verifyAccessToken(token)).toMatchObject({
      sub: 'abc',
      accountType: 'INDIVIDUAL',
    });
  });

  it('names the algorithm and the key in the header', async () => {
    const tokens = createTokenService(
      withKeys({
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: primary.publicKey,
        JWT_KEY_ID: 'access-2026-08',
      }),
    );

    const header = decodeProtectedHeader(
      await tokens.signAccessToken({ sub: 'abc', accountType: 'INDIVIDUAL' }),
    );

    expect(header.alg).toBe('EdDSA');
    // Without a `kid`, a verifier during a rotation has to try every published key.
    expect(header.kid).toBe('access-2026-08');
  });

  /** The whole reason for the change: signing material is no longer shared to verify. */
  it('refuses a token signed by a different key', async () => {
    const mine = createTokenService(
      withKeys({ JWT_PRIVATE_KEY: primary.privateKey, JWT_PUBLIC_KEY: primary.publicKey }),
    );
    const theirs = createTokenService(
      withKeys({ JWT_PRIVATE_KEY: other.privateKey, JWT_PUBLIC_KEY: other.publicKey }),
    );

    const forged = await theirs.signAccessToken({ sub: 'abc', accountType: 'INDIVIDUAL' });

    await expect(mine.verifyAccessToken(forged)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('refuses an HS256 token when configured for EdDSA', async () => {
    const symmetric = createTokenService(withKeys({}));
    const asymmetric = createTokenService(
      withKeys({ JWT_PRIVATE_KEY: primary.privateKey, JWT_PUBLIC_KEY: primary.publicKey }),
    );

    const hs256 = await symmetric.signAccessToken({ sub: 'abc', accountType: 'INDIVIDUAL' });

    // Note what this does and does not show. It proves a symmetric token is refused; it does not
    // prove the `algorithms` pin is what refuses it — removing that pin leaves this passing,
    // because jose will not use an Ed25519 key object as an HMAC secret in the first place. The
    // pin stays as the explicit statement of intent, not because this test would catch its loss.
    await expect(asymmetric.verifyAccessToken(hs256)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('still works with a shared secret when no key pair is configured', async () => {
    const tokens = createTokenService(withKeys({}));

    const token = await tokens.signAccessToken({ sub: 'abc', accountType: 'SCHOOL' });

    expect(await tokens.verifyAccessToken(token)).toMatchObject({ accountType: 'SCHOOL' });
    expect(decodeProtectedHeader(token).alg).toBe('HS256');
  });
});

describe('rotation', () => {
  it('keeps verifying tokens issued under the previous key', async () => {
    const oldService = createTokenService(
      withKeys({
        JWT_PRIVATE_KEY: other.privateKey,
        JWT_PUBLIC_KEY: other.publicKey,
        JWT_KEY_ID: 'access-old',
      }),
    );
    const issuedBefore = await oldService.signAccessToken({
      sub: 'abc',
      accountType: 'INDIVIDUAL',
    });

    // The rotation: a new pair signs, the old public key stays verifiable.
    const rotated = createTokenService(
      withKeys({
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: primary.publicKey,
        JWT_KEY_ID: 'access-new',
        JWT_PREVIOUS_PUBLIC_KEY: other.publicKey,
        JWT_PREVIOUS_KEY_ID: 'access-old',
      }),
    );

    expect(await rotated.verifyAccessToken(issuedBefore)).toMatchObject({ sub: 'abc' });

    // Nothing new is signed with the old key.
    const issuedAfter = await rotated.signAccessToken({ sub: 'abc', accountType: 'INDIVIDUAL' });
    expect(decodeProtectedHeader(issuedAfter).kid).toBe('access-new');
  });

  it('stops accepting the old key once it is dropped from the configuration', async () => {
    const oldService = createTokenService(
      withKeys({ JWT_PRIVATE_KEY: other.privateKey, JWT_PUBLIC_KEY: other.publicKey }),
    );
    const issuedBefore = await oldService.signAccessToken({
      sub: 'abc',
      accountType: 'INDIVIDUAL',
    });

    const afterOverlap = createTokenService(
      withKeys({ JWT_PRIVATE_KEY: primary.privateKey, JWT_PUBLIC_KEY: primary.publicKey }),
    );

    await expect(afterOverlap.verifyAccessToken(issuedBefore)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('GET /.well-known/jwks.json', () => {
  interface Jwks {
    keys: { kty: string; kid: string; use: string; alg: string; x?: string; d?: string }[];
  }

  it('publishes the public key, and nothing private', async () => {
    const app = createApp({
      config: withKeys({
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: primary.publicKey,
        JWT_KEY_ID: 'access-2026-08',
      }),
    });

    const response = await request(app).get('/.well-known/jwks.json');

    expect(response.status).toBe(200);

    const jwks = bodyAs<Jwks>(response);
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({
      kty: 'OKP',
      kid: 'access-2026-08',
      use: 'sig',
      alg: 'EdDSA',
    });
    // `d` is the private scalar. Publishing it would hand out the signing key.
    expect(jwks.keys[0]?.d).toBeUndefined();
  });

  it('publishes both keys during a rotation', async () => {
    const app = createApp({
      config: withKeys({
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: primary.publicKey,
        JWT_KEY_ID: 'access-new',
        JWT_PREVIOUS_PUBLIC_KEY: other.publicKey,
        JWT_PREVIOUS_KEY_ID: 'access-old',
      }),
    });

    const response = await request(app).get('/.well-known/jwks.json');

    expect(bodyAs<Jwks>(response).keys.map((key) => key.kid)).toEqual(['access-new', 'access-old']);
  });

  it('is not served at all when signing is symmetric', async () => {
    const app = createApp({ config: withKeys({}) });

    const response = await request(app).get('/.well-known/jwks.json');

    // 404 rather than an empty key set: there is no public half, and saying so with `{"keys":[]}`
    // would read as "asymmetric, keys missing".
    expect(response.status).toBe(404);
  });

  it('is cacheable — a verifier should not re-fetch on every request', async () => {
    const app = createApp({
      config: withKeys({ JWT_PRIVATE_KEY: primary.privateKey, JWT_PUBLIC_KEY: primary.publicKey }),
    });

    const response = await request(app).get('/.well-known/jwks.json');

    expect(response.headers['cache-control']).toContain('max-age=');
  });
});

describe('configuration', () => {
  it('refuses a private key with no public half', () => {
    expect(() =>
      loadConfig({
        ...process.env,
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: undefined,
      }),
    ).toThrow(/must be set together/);
  });

  it('refuses a previous key with no id to select it by', () => {
    expect(() =>
      loadConfig({
        ...process.env,
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: primary.publicKey,
        JWT_PREVIOUS_PUBLIC_KEY: other.publicKey,
      }),
    ).toThrow(/JWT_PREVIOUS_KEY_ID/);
  });
});

describe('the whole request path, signed asymmetrically', () => {
  /**
   * The unit tests above exercise the token service directly. This one goes through the app: a
   * real registration issues an EdDSA token, and the authenticate middleware verifies it against
   * the public key on the next request. It is the check that would have caught wiring the new
   * signer in without wiring the new verifier.
   */
  it('registers, then authenticates with the token that was issued', async () => {
    const db = testDb();
    await assertDbReachable();
    await resetDb();

    const app = createApp({
      db,
      config: withKeys({
        JWT_PRIVATE_KEY: primary.privateKey,
        JWT_PUBLIC_KEY: primary.publicKey,
        JWT_KEY_ID: 'access-e2e',
      }),
    });

    const registration = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `eddsa-${Date.now()}@fixture.test`,
        password: 'correct horse battery staple',
        fullName: 'Ed Dsa',
        handle: `eddsa${Date.now()}`,
      });

    expect(registration.status).toBe(201);

    const { accessToken } = bodyAs<{ accessToken: string }>(registration);
    expect(decodeProtectedHeader(accessToken).kid).toBe('access-e2e');

    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
  });

  afterAll(async () => {
    await closeTestDb();
  });
});
