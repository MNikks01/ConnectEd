# API — Conventions

`Status: Accepted` · `Last updated: 2026-08-02`

## HTTP methods

`GET` (read, safe) · `POST` (create / actions) · `PATCH` (partial update) · `PUT` (full replace, rare) ·
`DELETE` (soft-delete).

## Status codes

| Code | Use                                                 |
| ---- | --------------------------------------------------- |
| 200  | OK (read/update)                                    |
| 201  | Created                                             |
| 202  | Accepted (async accepted, e.g. queued)              |
| 204  | No Content (delete)                                 |
| 400  | Malformed request                                   |
| 401  | Unauthenticated (missing/invalid token)             |
| 403  | Authenticated but not permitted (RBAC/verification) |
| 404  | Not found (or hidden by scope)                      |
| 409  | Conflict (duplicate, illegal state transition)      |
| 422  | Validation error (field-level details)              |
| 429  | Rate limited                                        |
| 500  | Unexpected server error                             |
| 503  | Dependency unavailable                              |

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

## `/me/*` — asking about yourself

Every scoped endpoint is addressed from the **resource** inward: `/classes/:id/academics`,
`/schools/:id/members`, `/subjects/:id/syllabus`. That is right for authorization — the policy needs the
resource to reason about — and it leaves a hole: a screen that starts from the _person_ has nothing to ask.

Three endpoints were added one at a time to fill it, each discovered only when a screen could not be built:

| Endpoint            | Added | Because                                                             |
| ------------------- | ----- | ------------------------------------------------------------------- |
| `/me/memberships`   | S2-7  | A verified student could not find their own class.                  |
| `/me/subjects`      | S2-11 | A teacher's membership is school-wide, so it names no class.        |
| `/me/class-teacher` | S3-8  | Class-teacher allocation is stored on the class, not on the person. |

**The convention, from here on.** When a capability is granted through a row the caller does not own — a
membership, an allocation, a connection — there must be a `/me/*` endpoint that lists it. Adding the write
without the corresponding read ships a permission nobody can discover they have.

Such an endpoint is **scoped by the query, not by an id in the path**: `where: { accountId: actor.accountId }`,
never `/accounts/:id/...` with a check afterwards. Scoping the query is the version that cannot be forgotten,
and it is why none of these three needs an authorization policy at all.

## Dates and timestamps

Two different things, deliberately spelled differently on the wire.

| Kind              | Format                     | Used for                                   | Example                    |
| ----------------- | -------------------------- | ------------------------------------------ | -------------------------- |
| **Instant**       | ISO-8601 with offset (UTC) | Anything that happened at a moment in time | `2026-09-14T09:30:00.000Z` |
| **Calendar date** | `YYYY-MM-DD`, no time      | Anything counted in whole days             | `2026-09-14`               |

Leave `startDate`/`endDate` are **calendar dates** and the columns are `date`, not `timestamptz`. Sending an
instant instead is rejected rather than coerced: `2026-09-14T00:00:00Z` is the 13th of September in a school
west of Greenwich, so the same request would book a different day depending on where the server stood. A leave
day is the day the school says it is.

Event times (`eventAt`) and due dates (`dueAt`) are **instants** — an assembly starts at a time, not on a day.

## Headers

- `Authorization: Bearer <jwt>`
- `X-Correlation-Id` — echoed/propagated for tracing (generated if absent).
- `Idempotency-Key` — for POSTs with external side effects.
- `X-Client-Type: web | mobile` — enforces the school-web-only rule at login.

## Rate limiting

Per-account + per-IP token buckets on auth and write endpoints; `429` with `Retry-After`. Limits configured per
environment (`Security/` + `TRD` NFR-015).
