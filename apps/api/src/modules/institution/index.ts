/**
 * Public surface of the institution module.
 *
 * Other modules use `InstitutionService` or a domain event — never this module's repository or
 * Prisma models (`.docs/Architecture/01-modules.md`).
 */
import { createInstitutionRepository } from './institution.repository.js';
import { institutionRoutes } from './institution.routes.js';
import { createInstitutionService } from './institution.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type {
  EntitlementGuard,
  InstitutionService,
  MembershipDirectory,
} from './institution.service.js';

export type {
  EntitlementGuard,
  InstitutionService,
  MembershipDirectory,
} from './institution.service.js';

export interface InstitutionModule {
  routes: Router;
  service: InstitutionService;
}

export function createInstitutionModule(
  db: Db,
  membership: MembershipDirectory,
  entitlements: EntitlementGuard,
): InstitutionModule {
  const service = createInstitutionService({
    repository: createInstitutionRepository(db),
    membership,
    entitlements,
  });

  return { service, routes: institutionRoutes(service) };
}
