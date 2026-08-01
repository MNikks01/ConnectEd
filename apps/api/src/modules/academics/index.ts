/**
 * Public surface of the academics module.
 */
import { createAcademicsRepository } from './academics.repository.js';
import { academicsRoutes } from './academics.routes.js';
import { createAcademicsService } from './academics.service.js';
import { createNoticesRepository } from './notices.repository.js';
import { noticesRoutes } from './notices.routes.js';
import { createNoticesService } from './notices.service.js';
import { createSyllabusRepository } from './syllabus.repository.js';
import { syllabusRoutes } from './syllabus.routes.js';
import { createSyllabusService } from './syllabus.service.js';
import { createTimetableRepository } from './timetable.repository.js';
import { timetableRoutes } from './timetable.routes.js';
import { createTimetableService } from './timetable.service.js';

import { Router } from 'express';
import type { Db } from '../../shared/db/index.js';
import type { EventPublisher } from '../../shared/events/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { AcademicsService } from './academics.service.js';
import type { NoticesService } from './notices.service.js';
import type { SyllabusService } from './syllabus.service.js';
import type { TimetableService } from './timetable.service.js';

export type { AcademicsService } from './academics.service.js';
export type { NoticesService } from './notices.service.js';
export type { SyllabusService } from './syllabus.service.js';
export type { TimetableService } from './timetable.service.js';

export interface AcademicsModule {
  routes: Router;
  service: AcademicsService;
  notices: NoticesService;
  timetable: TimetableService;
  syllabus: SyllabusService;
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

  const notices = createNoticesService({
    repository: createNoticesRepository(deps.db),
    db: deps.db,
    events: deps.events,
    logger: deps.logger,
  });

  const timetable = createTimetableService({
    repository: createTimetableRepository(deps.db),
    db: deps.db,
    storage: deps.storage,
    logger: deps.logger,
  });

  const syllabus = createSyllabusService({
    repository: createSyllabusRepository(deps.db),
    db: deps.db,
    logger: deps.logger,
  });

  const routes = Router();
  routes.use(academicsRoutes(service));
  routes.use(noticesRoutes(notices));
  routes.use(timetableRoutes(timetable));
  routes.use(syllabusRoutes(syllabus));

  return { service, notices, timetable, syllabus, routes };
}
