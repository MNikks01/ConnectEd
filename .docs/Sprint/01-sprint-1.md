# Sprint 1 — Institution & verification

`Status: Planned` · `Last updated: 2026-07-31` · Duration: 2 weeks

Goal: a school can set itself up, and members can be verified into it. Maps to the first half of roadmap
**Phase 1**. This is a **proposal for planning** — adjust the split before committing.

## Sprint goal

> A school registers, creates its classes and subjects, and allocates a class teacher. A student, parent, and
> teacher each request verification; the school approves or rejects from a queue; and the server denies every
> academic-scoped read to anyone not `VERIFIED`.

Verification is the spine of the product (`PRD/03-verification.md`) — until it works, nothing in Phase 2 has
anything to gate on.

## Committed backlog (proposed)

| #    | Item                                                               | Owner (agent)    | Est. | DoD                                                                                |
| ---- | ------------------------------------------------------------------ | ---------------- | ---- | ---------------------------------------------------------------------------------- |
| S1-0 | Fix the stacked-PR CI gap; require checks on every PR              | devops           | S    | A PR into any base runs `verify`; branch protection blocks merge without it        |
| S1-1 | Institution module: school profile read/update (FR-INST-001)       | backend          | S    | `GET/PATCH /schools/:id`; only the school itself may write; ± permission tests     |
| S1-2 | Classes: create, list, deactivate (FR-INST-002, 006)               | backend          | M    | Uniqueness per (school, medium, level, section) enforced; ± permission tests       |
| S1-3 | Subjects per class (FR-INST-003)                                   | backend          | S    | `POST/GET /classes/:id/subjects`; unique per class; ± permission tests             |
| S1-4 | Verification requests: submit per role (FR-VER-001..004)           | backend          | M    | Student/parent/teacher/principal each create a `PENDING` request; no self-approval |
| S1-5 | Verification decisions: approve/reject queue (FR-VER-005, 008)     | backend/security | M    | Only the school decides; membership flips; `audit_log` written; ± permission tests |
| S1-6 | Class-teacher allocation (FR-INST-004)                             | backend          | S    | Exactly one per class; allocatee must be a verified teacher; ± permission tests    |
| S1-7 | Permission-matrix test suite over roles × capabilities             | qa/security      | M    | Iterates the matrix in `PRD/09-permissions-matrix.md`; fails on any undeclared gap |
| S1-8 | School portal shell (web): profile, classes, verification queue    | frontend         | L    | School can drive S1-1..S1-6 from the browser; all six UI states per view           |
| S1-9 | `packages/ui` foundation: tokens + the primitives the portal needs | ui-designer      | M    | Button/Input/Table/Dialog on tokens; theme-aware; WCAG AA; consumed by S1-8        |

## Stretch (only if committed done)

| #     | Item                                                          | Owner   |
| ----- | ------------------------------------------------------------- | ------- |
| S1-10 | Member roster + revoke (FR-INST-005)                          | backend |
| S1-11 | In-app notifications on verification transitions (FR-VER-007) | backend |
| S1-12 | Playwright E2E for the login and verification flows           | qa      |

## Dependencies / risks

- **S1-9 blocks S1-8.** Building the portal against a placeholder `packages/ui` means rewriting it later. If
  capacity is tight, cut portal scope rather than skipping the design system.
- **S1-4/S1-5 depend on S1-2** — a verification request names a class, so classes must exist first.
- **Notifications (FR-VER-007) need a queue.** BullMQ is decided (`ADR-0008`) but unbuilt; Redis is already in
  compose. Kept in stretch because the fan-out is a slice of its own.
- **Carry-over from Sprint 0 competes for the same capacity:** asymmetric token signing + JWKS, and web tests.
  Neither is in this backlog; decide explicitly whether to pull one in rather than letting them drift.

## Ceremonies

Planning · daily async standup · backlog refinement · review · retro.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI green ·
reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Academic content (homework, notices, events, timetable, syllabus) — Phase 2. Leave and complaints — Phase 3.
Social — Phase 4. Billing — Phase 5.

## Review notes

_Filled at sprint review._

## Retro

_Filled at retro._
