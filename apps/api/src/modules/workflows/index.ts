/**
 * Public surface of the workflows module — leave today, complaints next.
 */
import { Router } from 'express';

import { createFeedbackRepository } from './feedback.repository.js';
import { feedbackRoutes } from './feedback.routes.js';
import { createFeedbackService } from './feedback.service.js';
import { createLeaveRepository } from './leave.repository.js';
import { leaveRoutes } from './leave.routes.js';
import { createLeaveService } from './leave.service.js';

import type { Db } from '../../shared/db/index.js';
import type { EventPublisher } from '../../shared/events/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { FeedbackService } from './feedback.service.js';
import type { LeaveService } from './leave.service.js';

export type { FeedbackService } from './feedback.service.js';
export type { LeaveService } from './leave.service.js';

export interface WorkflowsModule {
  routes: Router;
  leave: LeaveService;
  feedback: FeedbackService;
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

  const feedback = createFeedbackService({
    repository: createFeedbackRepository(deps.db),
    db: deps.db,
    events: deps.events,
    logger: deps.logger,
  });

  const routes = Router();
  routes.use(leaveRoutes(leave));
  routes.use(feedbackRoutes(feedback));

  return { leave, feedback, routes };
}
