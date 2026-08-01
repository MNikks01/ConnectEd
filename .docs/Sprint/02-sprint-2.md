# Sprint 2 — Academic core

`Status: Planned` · `Last updated: 2026-08-01` · Duration: 2 weeks

Goal: the thing schools actually use the product for — publishing academic content to a verified class, and
knowing who has read it. Maps to the first half of roadmap **Phase 2**. This is a **proposal for planning** —
adjust the split before committing.

## Sprint goal

> A verified teacher publishes homework to a subject they are allocated to. Verified students and their parents
> see it in their class feed, open it, and the teacher sees who has read it. Everyone involved is notified.
> Nobody outside the class sees anything.

Every requirement here sits behind verification, which is why Sprint 1 built that first.

## Prerequisites — these are not optional, and neither exists yet

Both were confirmed absent in the codebase while writing this plan.

| #     | Item                                                                                | Why it blocks the sprint                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2-0a | **Object storage** (S3/MinIO client, upload + signed URL, type and size validation) | FR-ACAD-006 and FR-ACAD-020 both attach images. MinIO is already in compose; nothing in `apps/api` talks to it.                                                     |
| S2-0b | **Cursor pagination** (`?limit=&cursor=`, `nextCursor`) per `API/01-conventions.md` | A class feed is the first list that grows without bound. Six `findMany` calls currently return everything; a school with a year of homework would return all of it. |

Doing either late means retrofitting every endpoint built before it.

## Committed backlog (proposed)

| #     | Item                                                              | Owner (agent)  | Est. | DoD                                                                              |
| ----- | ----------------------------------------------------------------- | -------------- | ---- | -------------------------------------------------------------------------------- |
| S2-0a | Object storage: upload, signed URLs, validation                   | backend/devops | M    | Image round-trips through MinIO locally; type and size rejected server-side      |
| S2-0b | Cursor pagination helper + applied to existing list endpoints     | backend        | S    | `nextCursor` contract per API conventions; no unbounded `findMany` left          |
| S2-1  | Academic items: publish homework/assignment/project (FR-ACAD-001) | backend        | M    | Only a teacher allocated to that subject+class may publish; ± permission tests   |
| S2-2  | Class feed: verified members read items (FR-ACAD-002)             | backend        | M    | Student, parent-of-child, teacher, principal, school pass; everyone else 403/404 |
| S2-3  | Read tracking + per-item read counts (FR-ACAD-003)                | backend        | M    | Opening marks read once per member; author sees read/unread counts               |
| S2-4  | Author edit/delete, soft-delete (FR-ACAD-005)                     | backend        | S    | Author or school only; deleted items leave the feed but stay in the table        |
| S2-5  | Notices and events (FR-ACAD-010, 011)                             | backend        | M    | School/principal publish; community reads; ± permission tests                    |
| S2-6  | Academic events → notifications (FR-ACAD-004, 012)                | backend        | S    | Recipients are the verified members of the class, computed server-side           |
| S2-7  | Class feed and item views in the web app                          | frontend       | L    | A student sees their feed and opens an item; a teacher publishes; all six states |
| S2-8  | Notification bell and list in the web app                         | frontend       | M    | Unread count, list, mark read — S1-11 shipped the API with no UI                 |

## Stretch (only if committed done)

| #     | Item                                    | Owner    |
| ----- | --------------------------------------- | -------- |
| S2-9  | Timetable upload and view (FR-ACAD-020) | backend  |
| S2-10 | Syllabus coverage (FR-ACAD-030)         | backend  |
| S2-11 | Role dashboards beyond the class feed   | frontend |

## Dependencies / risks

- **S2-0a and S2-0b block almost everything else.** Sequence them first even though neither is a user-visible
  feature.
- **S2-3 read tracking is the first many-to-many write on a hot path.** `read_receipt` already has the unique
  constraint that makes marking read idempotent; the risk is N+1 counting on the feed, so the read count
  belongs in the same query rather than per item.
- **S2-6 is where notification recipients stop being one person.** Everything shipped so far notifies a single
  account; a class feed notifies every verified member, which is the first real use of the
  `(event_id, recipient_id)` constraint fixed in S1-11.
- **Carry-over competing for the same capacity:** asymmetric token signing + JWKS, alert routing, and the four
  unbuilt dashboards. None are in this backlog — decide explicitly rather than letting them drift a third
  sprint.

## Ceremonies

Planning · daily async standup · backlog refinement · review · retro.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI green ·
reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Leave and complaints — Phase 3. Social — Phase 4. Billing — Phase 5. Push notifications — mobile phase.

## Review notes

_Filled at sprint review._

## Retro

_Filled at retro._
