/**
 * HTTP shell for the auth module. No business logic here (`apps/api/CLAUDE.md` rule 2) — it reads
 * the request, calls a service, and shapes the response.
 *
 * It does own one HTTP-specific concern: where the refresh token lives. Web clients get an
 * httpOnly cookie the browser cannot hand to script; mobile clients get it in the body because
 * they have no cookie jar and use secure device storage instead.
 */
import { requireActor } from '../../shared/middleware/authenticate.js';

import type { AuthService, AuthSession, ClientType } from './auth.service.js';
import type { Config } from '../../shared/config/index.js';
import type { CookieOptions, Request, RequestHandler, Response } from 'express';

export const REFRESH_COOKIE = 'connected_refresh';

/** Scoped to the refresh route so the cookie is not attached to every request. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export interface AuthControllerDeps {
  service: AuthService;
  config: Config;
}

export interface AuthController {
  registerIndividual: RequestHandler;
  registerSchool: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  twoFactorLogin: RequestHandler;
  startTwoFactor: RequestHandler;
  confirmTwoFactor: RequestHandler;
  disableTwoFactor: RequestHandler;
  forgotPassword: RequestHandler;
  resetPassword: RequestHandler;
  me: RequestHandler;
}

export function createAuthController({ service, config }: AuthControllerDeps): AuthController {
  function cookieOptions(expires: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: config.cookieSecure,
      /**
       * 'strict', not 'lax'. Lax already withholds the cookie from cross-site subrequests, which
       * covers the POST that refresh actually uses — but it still sends it on a top-level GET
       * navigation from another site. Nothing reads this cookie from a GET today; 'strict' means
       * nothing can start to. The web app is unaffected either way: it talks to the API through
       * its own server, which sends the refresh token in the body, so the browser never presents
       * this cookie to the API at all.
       */
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires,
    };
  }

  /**
   * Web responses deliberately omit the refresh token from the body — putting it there would make
   * it readable by script, defeating the httpOnly cookie.
   */
  function sendSession(res: Response, session: AuthSession, clientType: ClientType): void {
    const body: Record<string, unknown> = {
      accessToken: session.accessToken,
      expiresIn: session.expiresInSeconds,
      tokenType: 'Bearer',
    };

    if (clientType === 'mobile') {
      body.refreshToken = session.refreshToken;
    } else {
      res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(session.refreshExpiresAt));
    }

    res.status(res.statusCode === 201 ? 201 : 200).json(body);
  }

  return {
    registerIndividual: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const session = await service.registerIndividual(req.body as never);
          res.status(201);
          sendSession(res, session, clientTypeOf(req));
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    registerSchool: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const session = await service.registerSchool(req.body as never);
          res.status(201);
          sendSession(res, session, clientTypeOf(req));
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    login: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const clientType = clientTypeOf(req);
          const result = await service.login(req.body as never, clientType);

          if ('twoFactorRequired' in result) {
            // 200 rather than 401: the credentials *were* accepted. A 401 here would tell a client
            // to re-prompt for a password, which is the wrong thing to ask for next.
            res.status(200).json(result);
            return;
          }

          sendSession(res, result, clientType);
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    refresh: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const clientType = clientTypeOf(req);
          const token = refreshTokenFrom(req);

          if (!token) {
            const { UnauthenticatedError } = await import('../../shared/errors/index.js');
            throw new UnauthenticatedError('Your session is invalid or has expired.');
          }

          const session = await service.refresh(token);
          sendSession(res, session, clientType);
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    logout: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          await service.logout(refreshTokenFrom(req));
          res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    /**
     * 202 whatever happened, and nothing in the body.
     *
     * Registered, not registered, mail sent, mail failed — one answer. Anything else turns this
     * into a way to ask "does this person have an account here?", which for a product used by
     * children is a question strangers should not be able to put to it.
     */
    twoFactorLogin: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const clientType = clientTypeOf(req);
          const { challengeToken, code } = req.body as { challengeToken: string; code: string };
          sendSession(
            res,
            await service.completeTwoFactorLogin(challengeToken, code, clientType),
            clientType,
          );
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    startTwoFactor: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          res.status(201).json(await service.startTwoFactorEnrolment(requireActor(req)));
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    confirmTwoFactor: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const { code } = req.body as { code: string };
          res.status(200).json(await service.confirmTwoFactorEnrolment(requireActor(req), code));
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    disableTwoFactor: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const { code } = req.body as { code: string };
          await service.disableTwoFactor(requireActor(req), code);
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    forgotPassword: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          await service.requestPasswordReset((req.body as { email: string }).email);
          res.status(202).end();
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    resetPassword: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const { token, password } = req.body as { token: string; password: string };
          await service.resetPassword(token, password);
          // 204 and no session. Signing them straight in would be convenient and would mean a
          // stolen link is a stolen session; making them log in proves they know the new password.
          res.status(204).end();
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,

    me: ((req: Request, res: Response, next) => {
      void (async () => {
        try {
          const actor = requireActor(req);
          res.status(200).json(await service.currentAccount(actor.accountId));
        } catch (error) {
          next(error);
        }
      })();
    }) satisfies RequestHandler,
  };
}

/**
 * `X-Client-Type` drives the school-web-only rule (`.docs/API/01-conventions.md`). It is a client
 * hint, not a security boundary — a mobile app could lie. The rule it feeds is a product
 * constraint, and anything that actually matters is enforced by role and membership instead.
 */
function clientTypeOf(req: Request): ClientType {
  return req.get('x-client-type')?.toLowerCase() === 'mobile' ? 'mobile' : 'web';
}

/** Cookie first (web), then body (mobile). */
function refreshTokenFrom(req: Request): string | undefined {
  const fromCookie = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  if (typeof fromCookie === 'string' && fromCookie.length > 0) return fromCookie;

  const fromBody = (req.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  return typeof fromBody === 'string' && fromBody.length > 0 ? fromBody : undefined;
}
