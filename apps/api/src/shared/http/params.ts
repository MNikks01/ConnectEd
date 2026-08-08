/**
 * Path-parameter reading.
 *
 * Express 5 types `req.params.x` as `string | string[]`, so it needs narrowing anyway — and that
 * is the right moment to check the shape. `.docs/API/01-conventions.md` says ids in URLs are
 * UUIDs; without this check a request like `/classes/garbage` reaches Prisma, which rejects the
 * malformed uuid and turns a client's typo into a 500.
 *
 * A syntactically impossible id cannot name a real resource, so 404 is both correct and
 * consistent with how out-of-scope resources are hidden elsewhere.
 */
import { NotFoundError } from '../errors/index.js';

import type { Request } from 'express';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function uuidParam(req: Request, name: string): string {
  const raw = req.params[name];

  if (typeof raw !== 'string' || !UUID.test(raw)) {
    throw new NotFoundError();
  }

  return raw;
}

/**
 * The same check for a query parameter that names a resource.
 *
 * `?termId=garbage` reaches Prisma exactly the way `/classes/garbage` would, and turns into the
 * same 500. A required id in a query string is still an id.
 */
export function uuidQuery(req: Request, name: string): string {
  const raw = req.query[name];

  if (typeof raw !== 'string' || !UUID.test(raw)) {
    throw new NotFoundError();
  }

  return raw;
}
