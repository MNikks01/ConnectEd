/**
 * Public surface of the notifications module.
 *
 * It subscribes to domain events rather than being called by other modules — the loose coupling
 * `.docs/Architecture/01-modules.md` rule 5 asks for. Nothing here is invoked by verification;
 * verification simply publishes what happened.
 */
import { createNotificationsRepository } from './notifications.repository.js';
import { notificationsRoutes } from './notifications.routes.js';
import { createNotificationsService } from './notifications.service.js';

import type { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { ClassAudience, NotificationsService } from './notifications.service.js';

export type {
  ClassAudience,
  NotificationsService,
  NotificationView,
} from './notifications.service.js';

export interface NotificationsModule {
  routes: Router;
  service: NotificationsService;
}

export function createNotificationsModule(
  db: Db,
  logger: Logger,
  audience?: ClassAudience,
): NotificationsModule {
  const service = createNotificationsService({
    repository: createNotificationsRepository(db),
    logger,
    audience,
  });

  return { service, routes: notificationsRoutes(service) };
}
