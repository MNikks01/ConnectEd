# @connected/types

## 0.9.0

### Minor Changes

- 7bf5542: Export and erasure — the two subject rights `Security/04-compliance.md` has promised since Sprint 2
  and the product has never had (S9-19, NFR-006, `PRD/14-export-and-erasure.md`).

  Any account can ask for **one JSON file containing everything held about it**, built off the request
  path by the worker, downloaded through a short-lived signed URL, and deleted seven days later. An
  individual can also **schedule their own erasure**, with a 30-day grace period they can cancel at
  any point.

  **The interesting decision is ADR-0020: erasure keeps the `account` row and empties it.** Fifty-odd
  tables carry an `account_id`, and the ones that matter most cascade — a pupil deleting their account
  would have taken a term of the school's attendance register, its marks and its report cards with
  them, which is a record the school is obliged to keep. So the row survives as a tombstone holding no
  personal data, everything that is only about the person is deleted outright, and the school's
  records go on pointing at an id that no longer resolves to anybody.

  Two smaller design points came out of building it. A message thread is **not** the erasing party's
  to delete — their messages go, the counterparty's stay, and the thread reads "A former member" on
  one side. And an uploaded object is not always the uploader's to take: a photograph attached to a
  homework item stays with the item.

  Also here: a settings sub-navigation, which fixes something older — `/settings/profile` and
  `/settings/security` had existed since Sprints 4 and 6 with nothing in the product linking to them.

## 0.8.0

### Minor Changes

- 3da52b0: Terms and report cards, server side (FR-GRADE-030 … 043).

  A school defines its own terms, and their date ranges may not overlap — an assessment must belong to
  one term or none. The class teacher or the school issues cards for a whole class in one action.

  A card is **issued, not rendered**: issuing copies every number onto it, so a later correction to a
  mark leaves an already-issued card alone. A school that wants the correction reflected reissues, and
  the new card says on its face that it replaced an earlier one and when that one was issued.

  The arithmetic carries the gradebook's rule through: an assessment a pupil was not marked for is
  excluded from both sides of the total rather than counted as zero, and a pupil with nothing marked
  has no percentage rather than a nought.

### Patch Changes

- c3f6287: Report cards on screen (S8-7), and the term list a class teacher needs to reach them.

  A school defines its terms at `/school/terms`; a class teacher issues a class's cards at
  `/classes/:id/report-cards`, and pupils and parents read their own there. The card renders the
  stored snapshot and computes nothing — the whole point of the feature is that what it says was
  decided when it was issued.

  Listing a school's terms is now open to any verified member of that school, rather than to the
  school account alone. Issuing names a term and the class teacher who issues is not the school, so
  the narrower rule allowed the action while hiding the only list to choose from.

## 0.7.0

### Minor Changes

- f2d1075: Adds the staff note (FR-GRADE-015): a mark carries a remark the family sees and a note only staff see, kept apart by response type rather than by filtering.

## 0.6.0

### Minor Changes

- 5b15360: Adds the attendance contract: taking a register, and the per-pupil read shapes (FR-ATT-001…031).

## 0.5.0

### Minor Changes

- d47a11c: Adds the gradebook contract: assessments, draft marks, publishing, and the per-pupil read shapes (FR-GRADE-001…023).
- 0c796b3: Adds `linkChildSchema` — the school confirming that a parent's child record and a student account are the same pupil (FR-GRADE-005).

## 0.4.0

### Minor Changes

- ddd083f: Adds the structured timetable to the contract (FR-ACAD-021): `uploadTimetableSchema` now takes either an `imageKey` or a set of `periods`, and `TimetableResponse` gains `kind` and `periods`.

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
