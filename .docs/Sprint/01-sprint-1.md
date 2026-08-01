# Sprint 1 — Institution & verification

`Status: Done` · `Last updated: 2026-08-01` · Duration: 2 weeks

Goal: a school can set itself up, and members can be verified into it. Maps to the first half of roadmap
**Phase 1**.

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

**Everything shipped** — the committed backlog _and_ all three stretch items.

| Item                                        | PR  |
| ------------------------------------------- | --- |
| S1-0 CI on every PR                         | #9  |
| S1-1..S1-3 institution module               | #10 |
| S1-4/S1-5 verification workflow             | #11 |
| S1-6 class teacher · S1-7 permission matrix | #12 |
| S1-9 design system                          | #13 |
| S1-8 school portal                          | #14 |
| S1-12 Playwright E2E                        | #15 |
| S1-10 member roster                         | #16 |
| S1-11 notifications + queue                 | #17 |

Tests grew from 98 to **268 API + 57 UI + 24 E2E**. CI runs `verify`, `e2e`, `changeset-check`, and CodeQL,
all on every pull request.

**Defects found in our own accepted docs and schema, and fixed:**

- `notification.event_id` was globally unique, but `PRD/07-notifications.md` requires idempotency by
  `(event_id, recipient_id)`. One event fanning out to a class of thirty would have created **one**
  notification and rejected twenty-nine — the opposite of FR-NOTIF-002.
- The permissions matrix marks General User as unable to declare an academic role, but every individual
  registers as `USER`. Read literally, nobody could ever become a student. Clarified in the doc.
- A newly registered school could not save its profile at all: an untouched optional field arrives as `''`,
  which `z.coerce.number()` turns into `0`, failing `min(1800)`. Found by the E2E suite on its first run.

**Bugs found by testing failure paths by hand, not by tests:**

- Publishing a domain event **hung** rather than failing when Redis was unreachable — ioredis queues commands
  while disconnected — so a committed verification decision appeared to fail. Now bounded and best-effort.
- The credential rate limiter was disabled by `config.isTest`, keying a security control to an unrelated flag.
  Now an explicit `RATE_LIMIT_ENABLED`.

**Architecture correction:** `institution` was querying `membership`, which `verification` owns, breaching
`Architecture/01-modules.md` rule 1. Membership reads now go through verification's public service behind a
narrow port.

**Process finding — the release to `main` was squashed, not merged.** `CI-CD/00-git-flow.md` line 24 specifies a
merge commit for the `development → main` release PR; PR #8 was squashed. The two branches' common ancestor is
therefore still the initial docs commit, so `git log main` does not show what shipped and every future release
PR re-lists work already released. Fix before the next release: allow merge commits on the repository and use
one for release PRs.

**Still open for the team:** branch protection does not _require_ the CI checks — they run, but nothing blocks a
merge on failure.

## Retro

_To be completed by the team at the retro — went well / didn't / actions with owners and due dates._
