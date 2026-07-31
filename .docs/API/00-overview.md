# API — Overview

`Status: Accepted` · `Last updated: 2026-07-28`

REST API served by `apps/api` (Express). JSON over HTTPS. The API is the **sole authority** — every request is
authenticated and authorized server-side.

## Conventions

- **Base path / versioning:** `/api/v1`. Breaking changes → `/api/v2` (`01-conventions.md`).
- **Format:** JSON request/response; `application/json`. UTF-8. Dates are ISO-8601 UTC.
- **IDs:** UUIDs in URLs.
- **Naming:** plural nouns for collections (`/schools`, `/classes`), sub-resources nested where ownership is
  strict (`/classes/:id/homework`).
- **Validation:** every request body/query validated with zod; 422 on failure with field errors.
- **Auth:** `Authorization: Bearer <access JWT>`; web also sends the httpOnly refresh cookie to `/auth/refresh`.
- **Pagination:** cursor-based (`?limit=&cursor=`) for feeds; `nextCursor` in the response.
- **Filtering/sorting:** documented per endpoint; whitelist only.
- **Idempotency:** unsafe external effects (billing, notifications) keyed by `Idempotency-Key` / event id.
- **Errors:** consistent envelope (`02-error-model.md`).
- **OpenAPI:** spec generated from zod schemas; served at `/api/v1/openapi.json` and rendered via Swagger UI in
  non-prod.

## Files

- [`01-conventions.md`](./01-conventions.md) — versioning, pagination, status codes, headers.
- [`02-error-model.md`](./02-error-model.md) — error envelope + catalogue.
- [`03-endpoints.md`](./03-endpoints.md) — endpoint catalogue by module.

## Client contract

Request/response DTOs are exported from `packages/types` (derived from the API zod schemas). The web app's typed
`api-client` consumes them so the client and server cannot drift.
