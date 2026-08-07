/**
 * Public surface of the attendance module.
 */
import { createAttendanceRepository } from './attendance.repository.js';
import { attendanceRoutes } from './attendance.routes.js';
import { createAttendanceService } from './attendance.service.js';

import type { Db } from '../../shared/db/index.js';
import type { Logger } from '../../shared/logger/index.js';
import type { AttendanceService } from './attendance.service.js';
import type { Router } from 'express';

export type { AttendanceService } from './attendance.service.js';

export interface AttendanceModule {
  service: AttendanceService;
  routes: Router;
}

export function createAttendanceModule(db: Db, logger: Logger): AttendanceModule {
  const service = createAttendanceService({
    repository: createAttendanceRepository(db),
    db,
    logger,
  });

  return { service, routes: attendanceRoutes(service) };
}
