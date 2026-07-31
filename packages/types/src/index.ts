/**
 * `@connected/types` — shared DTOs, enums, and request schemas.
 *
 * The single source of request/response shapes across `apps/api` and `apps/web`. Schemas are
 * defined once here and imported by both, so the client and server cannot drift
 * (`.docs/Architecture/03-frontend-architecture.md`).
 */
export * from './auth.js';
export * from './enums.js';
export * from './errors.js';
export * from './institution.js';
