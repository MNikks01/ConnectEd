/**
 * Public surface of the analytics module.
 *
 * Other modules use `AnalyticsService` — never this module's repository or Prisma models
 * (`.docs/Architecture/01-modules.md`).
 */
import { createAnalyticsRepository } from './analytics.repository.js';
import { analyticsRoutes } from './analytics.routes.js';
import { createAnalyticsService } from './analytics.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { AnalyticsService, FeatureGuard } from './analytics.service.js';

export type { AnalyticsService, FeatureGuard } from './analytics.service.js';

export interface AnalyticsModule {
  routes: Router;
  service: AnalyticsService;
}

export function createAnalyticsModule(db: Db, entitlements: FeatureGuard): AnalyticsModule {
  const service = createAnalyticsService({
    repository: createAnalyticsRepository(db),
    entitlements,
  });

  return { service, routes: analyticsRoutes(service) };
}
