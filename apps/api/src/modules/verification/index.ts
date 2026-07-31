/**
 * Public surface of the verification module.
 *
 * Other modules use `VerificationService` or a domain event — never this module's repository or
 * Prisma models (`.docs/Architecture/01-modules.md`).
 */
import { createVerificationRepository } from './verification.repository.js';
import { verificationRoutes } from './verification.routes.js';
import { createVerificationService } from './verification.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { VerificationService } from './verification.service.js';

export type { VerificationService } from './verification.service.js';

export interface VerificationModule {
  routes: Router;
  service: VerificationService;
}

export function createVerificationModule(db: Db, logger: Logger): VerificationModule {
  const service = createVerificationService({
    repository: createVerificationRepository(db),
    logger,
  });

  return { service, routes: verificationRoutes(service) };
}
