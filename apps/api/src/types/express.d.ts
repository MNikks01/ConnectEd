import type { Actor } from '../shared/authz/actor.js';

/** Request augmentations set by our own middleware. */
declare global {
  namespace Express {
    interface Request {
      /** Set by `correlationId()`; always present downstream of that middleware. */
      correlationId: string;
      /** Set by `authenticate()`; present only on routes behind it. Read via `requireActor`. */
      actor?: Actor;
    }
  }
}

export {};
