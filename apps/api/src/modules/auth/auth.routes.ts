/**
 * Auth routes (`.docs/API/03-endpoints.md`).
 *
 * Auth endpoints get their own rate limiter: they are the ones worth brute-forcing, and the
 * generic per-request limits are far too loose for credential stuffing (FR-AUTH-011).
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { authenticate } from '../../shared/middleware/authenticate.js';
import { validateBody } from '../../shared/middleware/validate.js';
import { createAuthController } from './auth.controller.js';
import {
  loginSchema,
  refreshSchema,
  registerIndividualSchema,
  registerSchoolSchema,
} from './auth.schema.js';

import type { AuthService } from './auth.service.js';
import type { Config } from '../../shared/config/index.js';
import type { TokenService } from '../../shared/auth/tokens.js';

export interface AuthRoutesDeps {
  service: AuthService;
  config: Config;
  tokens: TokenService;
}

export function authRoutes({ service, config, tokens }: AuthRoutesDeps): Router {
  const router = Router();
  const controller = createAuthController({ service, config });

  const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Explicitly configurable: automated suites drive far more auth traffic than a person, and
    // would otherwise fail for reasons unrelated to what they assert.
    skip: () => !config.RATE_LIMIT_ENABLED,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many attempts. Please try again later.',
        status: 429,
      },
    },
  });

  router.post(
    '/auth/register',
    credentialLimiter,
    validateBody(registerIndividualSchema),
    controller.registerIndividual,
  );

  router.post(
    '/auth/register/school',
    credentialLimiter,
    validateBody(registerSchoolSchema),
    controller.registerSchool,
  );

  router.post('/auth/login', credentialLimiter, validateBody(loginSchema), controller.login);

  // Refresh and logout carry no access token: the refresh token *is* the credential.
  router.post('/auth/refresh', credentialLimiter, validateBody(refreshSchema), controller.refresh);
  router.post('/auth/logout', validateBody(refreshSchema), controller.logout);

  router.get('/me', authenticate(tokens), controller.me);

  return router;
}
