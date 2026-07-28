# API — Conventions

`Status: Accepted` · `Last updated: 2026-07-28`

## HTTP methods

`GET` (read, safe) · `POST` (create / actions) · `PATCH` (partial update) · `PUT` (full replace, rare) ·
`DELETE` (soft-delete).

## Status codes

| Code | Use |
|---|---|
| 200 | OK (read/update) |
| 201 | Created |
| 202 | Accepted (async accepted, e.g. queued) |
| 204 | No Content (delete) |
| 400 | Malformed request |
| 401 | Unauthenticated (missing/invalid token) |
| 403 | Authenticated but not permitted (RBAC/verification) |
| 404 | Not found (or hidden by scope) |
| 409 | Conflict (duplicate, illegal state transition) |
| 422 | Validation error (field-level details) |
| 429 | Rate limited |
| 500 | Unexpected server error |
| 503 | Dependency unavailable |

> **404 vs 403:** to avoid leaking existence of resources a caller can't see, out-of-scope resources return
> **404** on reads; explicit permission failures on owned-but-forbidden actions return **403**.

## Versioning

- URL-based: `/api/v1/...`. Only breaking changes bump the major.
- Additive changes (new optional fields/endpoints) ship within the current version.
- Deprecations announced via `Deprecation` + `Sunset` headers and changelog.

## Pagination

Cursor-based for lists that grow (feeds, notifications, messages):
```
GET /api/v1/classes/:id/homework?limit=20&cursor=<opaque>
200 { "data": [...], "nextCursor": "<opaque|null>" }
```
Offset pagination only for small, bounded admin lists.

## Headers

- `Authorization: Bearer <jwt>`
- `X-Correlation-Id` — echoed/propagated for tracing (generated if absent).
- `Idempotency-Key` — for POSTs with external side effects.
- `X-Client-Type: web | mobile` — enforces the school-web-only rule at login.

## Rate limiting

Per-account + per-IP token buckets on auth and write endpoints; `429` with `Retry-After`. Limits configured per
environment (`Security/` + `TRD` NFR-015).
