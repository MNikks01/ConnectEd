/**
 * Public surface of the moderation module (ADR-0017).
 */
import { createModerationQueueRepository } from './moderation-queue.repository.js';
import { moderationQueueRoutes } from './moderation-queue.routes.js';
import { createModerationQueueService } from './moderation-queue.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { ModerationQueueService } from './moderation-queue.service.js';

export type { ModerationQueueService } from './moderation-queue.service.js';

export interface ModerationQueueModule {
  routes: Router;
  service: ModerationQueueService;
}

export function createModerationQueueModule(db: Db): ModerationQueueModule {
  const service = createModerationQueueService({
    db,
    repository: createModerationQueueRepository(db),
  });

  return { service, routes: moderationQueueRoutes(service) };
}
