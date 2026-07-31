/**
 * Terminal 404 handler — converts unmatched routes into the standard error envelope by delegating
 * to the global error middleware rather than writing a response of its own.
 */
import { NotFoundError } from '../errors/index.js';

import type { NextFunction, Request, Response } from 'express';

export function notFound() {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next(new NotFoundError());
  };
}
