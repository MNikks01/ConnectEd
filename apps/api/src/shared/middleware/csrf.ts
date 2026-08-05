/**
 * Origin checking for cookie-authenticated writes.
 *
 * The refresh cookie is `httpOnly` and `SameSite=Strict`, which already stops a cross-site form
 * from carrying it — that is the primary defence and it has been there since ADR-0007. This is the
 * second one, and it exists for the cases SameSite alone does not cover:
 *
 * - A browser that does not enforce `SameSite`, or a future in which the attribute is relaxed for
 *   compatibility. The cookie's protection would evaporate silently.
 * - A same-site subdomain that gets compromised. `Strict` is same-*site*, not same-*origin*, so
 *   `evil.connected.example` is not cross-site and its requests would carry the cookie.
 *
 * **It only applies to requests that actually present the cookie.** Everything else in this API is
 * authorized by an `Authorization` header, which a cross-site page cannot set without a preflight
 * the CORS policy refuses — so those routes were never reachable this way, and mobile clients that
 * send no `Origin` at all must not be broken by a control aimed at browsers.
 */
import { ForbiddenError } from '../errors/index.js';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyOrigin(allowedOrigin: string, cookieName: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // No cookie, no cross-site risk worth this check: the request is either unauthenticated or
    // carries a bearer token, and neither is something a foreign page can cause a browser to send.
    const cookies = req.cookies as Record<string, string> | undefined;
    if (!cookies?.[cookieName]) {
      next();
      return;
    }

    const origin = req.get('origin');

    // A browser always sends `Origin` on a cross-origin write, and modern ones send it on
    // same-origin writes too. Its *absence* on a cookie-bearing write is a non-browser client
    // replaying a cookie it should not have, so it is refused rather than waved through.
    if (origin !== allowedOrigin) {
      throw new ForbiddenError('This request did not come from the application.');
    }

    next();
  };
}
