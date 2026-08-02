/**
 * `/.well-known/jwks.json` — the public keys access tokens are signed with (ADR-0014).
 *
 * Unauthenticated and cacheable on purpose: these keys are public by definition, and a verifier
 * that had to authenticate to fetch them would need a credential to check a credential.
 *
 * Absent entirely when signing is symmetric. An HS256 secret has no public half, and an endpoint
 * that answered `{"keys":[]}` in that case would invite someone to conclude the API is asymmetric
 * and has simply lost its keys.
 */
import { Router } from 'express';

import type { TokenService } from '../shared/auth/tokens.js';
import type { Router as ExpressRouter } from 'express';

/** Long enough to matter, short enough that a rotation is picked up within the overlap window. */
const CACHE_SECONDS = 300;

export function jwksRoutes(tokens: TokenService): ExpressRouter {
  const router = Router();

  router.get('/.well-known/jwks.json', (_req, res, next) => {
    void tokens
      .publicJwks()
      .then((jwks) => {
        res.set('Cache-Control', `public, max-age=${CACHE_SECONDS}`);
        res.status(200).json(jwks);
      })
      .catch(next);
  });

  return router;
}
