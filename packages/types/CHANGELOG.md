# @connected/types

## 0.3.0

### Minor Changes

- 2aec30f: Add the bulk verification-decision schema and result DTO (FR-VER-009). Partial success is
  reported per request rather than rolled back — a school approving forty people while its plan
  allows thirty should get thirty members and a list of ten.
- f2f28db: Add the notification-preference schema and DTOs (FR-NOTIF-006). The dispatcher has honoured
  preferences since Sprint 2; nothing could set them until now.
- 69df427: Add the password-reset schemas (FR-AUTH-009). Somebody who forgot their password had no way back
  into their account at all; now there is one, with a 30-minute single-use token that revokes every
  session when it is spent.
- c651f0e: Add the two-factor schemas and DTOs (FR-AUTH-012): enrolment, confirmation, and the challenge a
  login returns when a code is still owed.

### Patch Changes

- 839dea2: `/me` now reports whether a confirmed second factor is in place, so the settings page can render
  the right state (FR-AUTH-012). For rendering, not for trust — every 2FA endpoint re-reads it.

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
