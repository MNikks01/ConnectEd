# @connected/types

## 0.2.0

### Minor Changes

- 12c759f: Add the moderation-queue DTOs — deliberately without the reporter, because the reporting form
  promises that nobody at their school is told and a DTO is where that promise is kept or broken
  (S6-5, S6-6, ADR-0017).
- 23aa7d5: Add the school-analytics DTOs and the `FEATURE_NOT_IN_PLAN` error code (402) — a sibling of
  `PLAN_LIMIT_EXCEEDED` for a feature a plan never included, rather than a limit it has reached
  (S6-7).

### Patch Changes

- 7b385b2: `/me` now reports whether the caller is ConnectEd staff, so the web app knows whether to offer the
  moderation console. Navigation only — every moderation endpoint re-reads the row itself (S6-6,
  ADR-0017).

## 0.1.0

### Minor Changes

- 9f1252f: Billing DTOs: `SubscriptionResponse`, plan limits and features, and usage measured against them.

  The API side (S5-1, S5-2) is a plan catalogue, entitlement resolution, and a trial created in the
  same statement as the school — `@connected/api` is private and ignored by changesets, so only the
  shared types carry a version bump.

- b32e8b3: Add the RUM payload schemas — a closed set of Web Vital names, bounded values, and a path the
  server derives a label from rather than trusting. The ingest endpoint and the browser reporter are
  in the private packages (S5-13).

### Patch Changes

- 960110d: Add `PLAN_LIMIT_EXCEEDED` to the shared error catalogue (402), so a client can branch on "this
  school needs a bigger plan" without parsing prose. Enforcement itself is in `@connected/api`
  (S5-3), which is private and ignored by changesets.
