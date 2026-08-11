/**
 * Public surface of the privacy module — export and erasure
 * (`.docs/PRD/14-export-and-erasure.md`, ADR-0020).
 *
 * The service is exported as well as the routes because the **worker** drives three of its
 * entry points on a schedule: building the bundles, sweeping expired ones, and executing due
 * erasures. None of those has a caller waiting on it, and none belongs on a request thread.
 */
import { createPrivacyRepository } from './privacy.repository.js';
import { privacyRoutes } from './privacy.routes.js';
import { createPrivacyService } from './privacy.service.js';

import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { PrivacyService } from './privacy.service.js';
import type { Router } from 'express';

export type { PrivacyService } from './privacy.service.js';
export { EXPORT_TTL_DAYS, ERASURE_GRACE_DAYS } from './privacy.repository.js';

export interface PrivacyModule {
  service: PrivacyService;
  routes: Router;
}

export interface CreatePrivacyModuleOptions {
  db: Db;
  logger: Logger;
  storage?: Storage | undefined;
  /** The login throttle's key function — see the note on `PrivacyRepositoryDeps.hashEmail`. */
  hashEmail: (email: string) => string;
}

export function createPrivacyModule({
  db,
  logger,
  storage,
  hashEmail,
}: CreatePrivacyModuleOptions): PrivacyModule {
  const service = createPrivacyService({
    repository: createPrivacyRepository({ db, hashEmail }),
    db,
    logger,
    storage,
  });

  return { service, routes: privacyRoutes(service) };
}
