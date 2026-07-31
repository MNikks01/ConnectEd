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

import { jwtVerify, SignJWT } from 'jose';

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
}

const ISSUER = 'connected-api';
const AUDIENCE = 'connected-clients';

export function createTokenService(config: Config): TokenService {
  const secret = new TextEncoder().encode(config.JWT_ACCESS_SECRET);

  return {
    accessTokenTtlSeconds: config.ACCESS_TOKEN_TTL_SECONDS,

    signAccessToken: async (claims: AccessTokenClaims) => {
      const jwt = new SignJWT({
        accountType: claims.accountType,
        ...(claims.role ? { role: claims.role } : {}),
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(claims.sub)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`);

      return jwt.sign(secret);
    },

    verifyAccessToken: async (token: string) => {
      try {
        const { payload } = await jwtVerify(token, secret, {
          issuer: ISSUER,
          audience: AUDIENCE,
          // Pinning the algorithm blocks the `alg: none` and algorithm-confusion families.
          algorithms: ['HS256'],
        });

        if (typeof payload.sub !== 'string' || typeof payload.accountType !== 'string') {
          throw new UnauthenticatedError();
        }

        return {
          sub: payload.sub,
          accountType: payload.accountType as AccountType,
          ...(typeof payload.role === 'string' ? { role: payload.role as UserRole } : {}),
        };
      } catch {
        // Expired, tampered, wrong issuer — all the same to the caller. Distinguishing them
        // tells an attacker which part of the forgery to fix.
        throw new UnauthenticatedError('Your session is invalid or has expired.');
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
