/**
 * Public surface of the gradebook module.
 */
import { createGradebookRepository } from './gradebook.repository.js';
import { gradebookRoutes } from './gradebook.routes.js';
import { createGradebookService } from './gradebook.service.js';

import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { GradebookService } from './gradebook.service.js';
import type { Router } from 'express';

export type { GradebookService } from './gradebook.service.js';

export interface GradebookModule {
  service: GradebookService;
  routes: Router;
}

export function createGradebookModule(db: Db, logger: Logger): GradebookModule {
  const service = createGradebookService({
    repository: createGradebookRepository(db),
    db,
    logger,
  });

  return { service, routes: gradebookRoutes(service) };
}
