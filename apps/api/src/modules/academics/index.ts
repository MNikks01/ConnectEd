/**
 * Public surface of the academics module.
 */
import { createAcademicsRepository } from './academics.repository.js';
import { academicsRoutes } from './academics.routes.js';
import { createAcademicsService } from './academics.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { EventPublisher } from '../../shared/events/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { AcademicsService } from './academics.service.js';

export type { AcademicsService } from './academics.service.js';

export interface AcademicsModule {
  routes: Router;
  service: AcademicsService;
}

export function createAcademicsModule(deps: {
  db: Db;
  storage?: Storage | undefined;
  events: EventPublisher;
  logger: Logger;
}): AcademicsModule {
  const service = createAcademicsService({
    repository: createAcademicsRepository(deps.db),
    db: deps.db,
    storage: deps.storage,
    events: deps.events,
    logger: deps.logger,
  });

  return { service, routes: academicsRoutes(service) };
}
