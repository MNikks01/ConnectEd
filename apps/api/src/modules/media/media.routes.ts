/**
 * Media routes.
 *
 * Multer holds the file in memory rather than on disk: uploads are small, capped, and go straight
 * out to object storage, so a temp file would be a second thing to clean up and a second place a
 * child's photo could be left behind.
 *
 * The multer limit is the real defence — it aborts mid-stream, so an oversized upload is rejected
 * without ever being fully buffered. The service checks size again because it cannot assume every
 * caller came through this route.
 */
import { Router } from 'express';
import multer from 'multer';

import { requireActor } from '../../shared/middleware/authenticate.js';
import { ValidationFailedError } from '../../shared/errors/index.js';

import type { MediaService } from './media.service.js';
import type { RequestHandler, Router as ExpressRouter } from 'express';

export interface MediaRoutesDeps {
  service: MediaService;
  maxBytes: number;
}

export function mediaRoutes({ service, maxBytes }: MediaRoutesDeps): ExpressRouter {
  const router = Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
  });

  router.post('/media/:prefix', (req, res, next) => {
    upload.single('file')(req, res, (error: unknown) => {
      if (error) {
        // Multer's own errors (size, file count) become the standard envelope rather than a 500.
        const message =
          error instanceof Error && error.message.includes('File too large')
            ? `Files must be ${Math.floor(maxBytes / 1024 / 1024)}MB or smaller.`
            : 'The upload could not be read.';

        next(new ValidationFailedError([{ field: 'file', issue: message }]));
        return;
      }

      void service
        .uploadImage(requireActor(req), req.file, req.params.prefix ?? '')
        .then((result) => {
          res.status(201).json(result);
        })
        .catch(next);
    });
  });

  return router;
}

export type { RequestHandler };
