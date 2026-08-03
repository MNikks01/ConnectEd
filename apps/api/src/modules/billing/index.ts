/**
 * Public surface of the billing module.
 *
 * Other modules use `BillingService` — never this module's repository or Prisma models
 * (`.docs/Architecture/01-modules.md`). `auth` uses `trialTerms()` to give a new school a trial in
 * the same statement that creates it; enforcement (S5-3) will use `entitlementsFor()`.
 */
import { createBillingRepository } from './billing.repository.js';
import { billingRoutes } from './billing.routes.js';
import { createBillingService } from './billing.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { BillingService } from './billing.service.js';

export type { BillingService, Entitlements, TrialTerms } from './billing.service.js';
export { PLAN_CATALOGUE, TRIAL_DAYS, TRIAL_PLAN_CODE, planDefinition } from './plan-catalogue.js';
export type { PlanDefinition, PlanFeatures, PlanLimits } from './plan-catalogue.js';

export interface BillingModule {
  routes: Router;
  service: BillingService;
}

export function createBillingModule(db: Db, logger: Logger): BillingModule {
  const service = createBillingService({ repository: createBillingRepository(db), logger });

  return { service, routes: billingRoutes(service) };
}
