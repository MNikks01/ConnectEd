/**
 * Public surface of the report-cards module.
 */
import { createReportCardsRepository } from './reportcards.repository.js';
import { reportCardsRoutes } from './reportcards.routes.js';
import { createReportCardsService } from './reportcards.service.js';

import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { ReportCardsService } from './reportcards.service.js';
import type { Router } from 'express';

export type { ReportCardsService } from './reportcards.service.js';

export interface ReportCardsModule {
  service: ReportCardsService;
  routes: Router;
}

export function createReportCardsModule(db: Db, logger: Logger): ReportCardsModule {
  const service = createReportCardsService({
    repository: createReportCardsRepository(db),
    db,
    logger,
  });

  return { service, routes: reportCardsRoutes(service) };
}
