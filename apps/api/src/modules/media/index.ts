/**
 * Public surface of the media module.
 *
 * Other modules use `Storage.signedUrl` directly once they have authorized the caller — media
 * owns writing, not who may read.
 */
import { mediaRoutes } from './media.routes.js';
import { createMediaService } from './media.service.js';

import type { Router } from 'express';
import type { Logger } from '../../shared/logger/index.js';
import type { Storage } from '../../shared/storage/index.js';
import type { MediaService } from './media.service.js';

export type { MediaService, UploadResult } from './media.service.js';

export interface MediaModule {
  routes: Router;
  service: MediaService;
}

export function createMediaModule(storage: Storage, logger: Logger, maxBytes: number): MediaModule {
  const service = createMediaService({ storage, logger, maxBytes });

  return { service, routes: mediaRoutes({ service, maxBytes }) };
}
