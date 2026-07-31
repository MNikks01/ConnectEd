/**
 * Authentication middleware — layer 1 of `.docs/Security/02-authorization.md`.
 *
 * Turns a bearer token into `req.actor`. It answers *who* the caller is and nothing about what
 * they may do; every authorization decision happens later, in a service policy.
 */
import { UnauthenticatedError } from '../errors/index.js';

import type { Actor } from '../authz/actor.js';
import type { TokenService } from '../auth/tokens.js';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Rejects the request unless a valid access token is present. */
export function authenticate(tokens: TokenService): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    void (async () => {
      try {
        const claims = await tokens.verifyAccessToken(bearerToken(req));

        req.actor = {
          accountId: claims.sub,
          accountType: claims.accountType,
          ...(claims.role ? { role: claims.role } : {}),
        };

        next();
      } catch (error) {
        next(error);
      }
    })();
  };
}

function bearerToken(req: Request): string {
  const header = req.get('authorization');

  if (!header?.startsWith('Bearer ')) {
    throw new UnauthenticatedError('Authentication is required.');
  }

  const token = header.slice('Bearer '.length).trim();
  if (token.length === 0) {
    throw new UnauthenticatedError('Authentication is required.');
  }

  return token;
}

/**
 * Reads `req.actor` for handlers that run behind `authenticate`.
 *
 * Throwing rather than returning `Actor | undefined` keeps the "authenticated" guarantee at the
 * type level: a handler cannot accidentally treat an anonymous request as a known one.
 */
export function requireActor(req: Request): Actor {
  if (!req.actor) {
    throw new UnauthenticatedError('Authentication is required.');
  }

  return req.actor;
}
