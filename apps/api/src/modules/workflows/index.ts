/**
 * Public surface of the workflows module — leave today, complaints next.
 */
import { Router } from 'express';

import { createLeaveRepository } from './leave.repository.js';
import { leaveRoutes } from './leave.routes.js';
import { createLeaveService } from './leave.service.js';

import type { Db } from '../../shared/db/index.js';
import type { EventPublisher } from '../../shared/events/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { LeaveService } from './leave.service.js';

export type { LeaveService } from './leave.service.js';

export interface WorkflowsModule {
  routes: Router;
  leave: LeaveService;
}

export function createWorkflowsModule(deps: {
  db: Db;
  events: EventPublisher;
  logger: Logger;
}): WorkflowsModule {
  const leave = createLeaveService({
    repository: createLeaveRepository(deps.db),
    db: deps.db,
    events: deps.events,
    logger: deps.logger,
  });

  const routes = Router();
  routes.use(leaveRoutes(leave));

  return { leave, routes };
}
