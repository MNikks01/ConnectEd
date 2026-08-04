/**
 * Access and refresh token handling (ADR-0007, `.docs/Security/01-authentication.md`).
 *
 * Access tokens are JWTs the API verifies without a database round-trip. Refresh tokens are
 * **opaque random strings** — not JWTs — so they carry no claims a client could read and are
 * useless without the server-side row. Only their SHA-256 digest is stored: a database leak
 * therefore does not yield usable sessions.
 *
 * SHA-256 rather than argon2 for refresh tokens is deliberate. Argon2 exists to make *guessing*
 * expensive for low-entropy secrets; these are 256 bits of CSPRNG output, so there is nothing to
 * guess, and a slow hash on every refresh would be a self-inflicted DoS.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  exportJWK,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWK,
  type KeyObject,
} from 'jose';

import { UnauthenticatedError } from '../errors/index.js';

import type { Config } from '../config/index.js';
import type { AccountType, UserRole } from '../../generated/prisma/client.js';

/** Claims carried in the access token. Kept small — it travels on every request. */
export interface AccessTokenClaims {
  sub: string;
  accountType: AccountType;
  /** Absent for SCHOOL accounts, which have no role. */
  role?: UserRole;
}

export interface IssuedRefreshToken {
  /** Returned to the client once, never stored in this form. */
  token: string;
  /** What we persist. */
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export interface TokenService {
  signAccessToken: (claims: AccessTokenClaims) => Promise<string>;
  verifyAccessToken: (token: string) => Promise<AccessTokenClaims>;
  issueRefreshToken: (familyId?: string) => IssuedRefreshToken;
  hashRefreshToken: (token: string) => string;
  readonly accessTokenTtlSeconds: number;
  /**
   * The public keys, as a JWKS. Empty when signing is symmetric — an HS256 secret must never be
   * published, and returning an empty set says "nothing here to verify with" rather than leaking.
   */
  publicJwks: () => Promise<{ keys: JWK[] }>;
}

const ISSUER = 'connected-api';
const AUDIENCE = 'connected-clients';

/**
 * Key material, resolved once at startup.
 *
 * Asymmetric when a private key is configured, symmetric otherwise. The two modes never mix: the
 * algorithm is pinned to exactly one value at verification, so a token signed the other way is
 * refused rather than falling back — that fallback *is* the algorithm-confusion attack.
 */
interface Keys {
  algorithm: 'EdDSA' | 'HS256';
  sign: KeyObject | Uint8Array;
  /** Ordered: the current key first, so a rotation's overlap costs one failed check at most. */
  verify: { kid?: string; key: KeyObject | Uint8Array }[];
  jwks: JWK[];
}

async function resolveKeys(config: Config): Promise<Keys> {
  if (!config.JWT_PRIVATE_KEY || !config.JWT_PUBLIC_KEY) {
    const secret = new TextEncoder().encode(config.JWT_ACCESS_SECRET);
    return { algorithm: 'HS256', sign: secret, verify: [{ key: secret }], jwks: [] };
  }

  const privateKey = await importPKCS8(config.JWT_PRIVATE_KEY, 'EdDSA');
  const publicKey = await importSPKI(config.JWT_PUBLIC_KEY, 'EdDSA');

  const verify: Keys['verify'] = [{ kid: config.JWT_KEY_ID, key: publicKey }];
  const jwks: JWK[] = [
    { ...(await exportJWK(publicKey)), kid: config.JWT_KEY_ID, use: 'sig', alg: 'EdDSA' },
  ];

  if (config.JWT_PREVIOUS_PUBLIC_KEY && config.JWT_PREVIOUS_KEY_ID) {
    const previous = await importSPKI(config.JWT_PREVIOUS_PUBLIC_KEY, 'EdDSA');

    verify.push({ kid: config.JWT_PREVIOUS_KEY_ID, key: previous });
    jwks.push({
      ...(await exportJWK(previous)),
      kid: config.JWT_PREVIOUS_KEY_ID,
      use: 'sig',
      alg: 'EdDSA',
    });
  }

  return { algorithm: 'EdDSA', sign: privateKey, verify, jwks };
}

export function createTokenService(config: Config): TokenService {
  // Imported lazily and cached: `createTokenService` is synchronous by contract and called from
  // app construction, while key import is not.
  let keys: Promise<Keys> | undefined;
  const getKeys = (): Promise<Keys> => (keys ??= resolveKeys(config));

  return {
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,

    publicJwks: async () => ({ keys: (await getKeys()).jwks }),

    signAccessToken: async (claims: AccessTokenClaims) => {
      const { algorithm, sign } = await getKeys();

      const jwt = new SignJWT({
        accountType: claims.accountType,
        ...(claims.role ? { role: claims.role } : {}),
      })
        .setProtectedHeader({
          alg: algorithm,
          // The key id travels with the token, so a verifier during a rotation knows which of the
          // published keys to use rather than guessing.
          ...(algorithm === 'EdDSA' ? { kid: config.JWT_KEY_ID } : {}),
        })
        .setSubject(claims.sub)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`);

      return jwt.sign(sign);
    },

    verifyAccessToken: async (token: string) => {
      const { algorithm, verify } = await getKeys();

      try {
        const payload = await verifyWithAny(token, verify, algorithm);

        if (typeof payload.sub !== 'string' || typeof payload.accountType !== 'string') {
          throw new UnauthenticatedError();
        }

        return {
          sub: payload.sub,
          accountType: payload.accountType as AccountType,
          ...(typeof payload.role === 'string' ? { role: payload.role as UserRole } : {}),
        };
      } catch (error) {
        // Expired, tampered, wrong issuer — all the same to the caller. Distinguishing them
        // tells an attacker which part of the forgery to fix. The reason travels separately, to
        // the logs, where the person reading is the operator rather than the sender.
        throw new UnauthenticatedError(
          'Your session is invalid or has expired.',
          error instanceof Error ? `${error.name}: ${error.message}` : 'unknown',
        );
      }
    },

    issueRefreshToken: (familyId?: string) => {
      const token = randomBytes(32).toString('base64url');

      return {
        token,
        tokenHash: sha256(token),
        familyId: familyId ?? randomBytes(16).toString('hex'),
        expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_SECONDS * 1000),
      };
    },

    hashRefreshToken: sha256,
  };
}

/**
 * Tries each configured public key, current first.
 *
 * Only one is ever right, and during a rotation the old one is right for tokens issued before it.
 * The algorithm is pinned, so this cannot degrade into "accept whatever the header claims".
 */
async function verifyWithAny(
  token: string,
  keys: Keys['verify'],
  algorithm: Keys['algorithm'],
): Promise<Record<string, unknown>> {
  let lastError: unknown;

  for (const candidate of keys) {
    try {
      const { payload } = await jwtVerify(token, candidate.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        // Pinned to exactly one algorithm. jose already refuses to use a public key object as an
        // HMAC secret, so the classic confusion attack cannot land regardless — this states the
        // intent explicitly rather than relying on that.
        algorithms: [algorithm],
      });

      return payload;
    } catch (error) {
      // Try the next key. The caller turns "none of them" into one opaque failure, so which key
      // failed and why never reaches the client — but the last reason is kept for the logs.
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new UnauthenticatedError();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison for digests, so lookups cannot be timed. */
export function digestsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'hex');
  const bufferB = Buffer.from(b, 'hex');

  if (bufferA.length !== bufferB.length) return false;

  return timingSafeEqual(bufferA, bufferB);
}
