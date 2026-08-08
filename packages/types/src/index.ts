/**
 * `@connected/types` — shared DTOs, enums, and request schemas.
 *
 * The single source of request/response shapes across `apps/api` and `apps/web`. Schemas are
 * defined once here and imported by both, so the client and server cannot drift
 * (`.docs/Architecture/03-frontend-architecture.md`).
 */
/**
 * A cursor-paginated response (`.docs/API/01-conventions.md`). `nextCursor` is `null` when the
 * list is exhausted, so a client stops rather than guessing.
 */
export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

export * from './academics.js';
export * from './analytics.js';
export * from './auth.js';
export * from './billing.js';
export * from './enums.js';
export * from './errors.js';
export * from './gradebook.js';
export * from './institution.js';
export * from './moderation.js';
export * from './notices.js';
export * from './notifications.js';
export * from './rum.js';
export * from './report-cards.js';
export * from './social.js';
export * from './verification.js';
export * from './workflows.js';
