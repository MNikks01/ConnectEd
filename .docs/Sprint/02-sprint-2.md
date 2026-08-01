# Sprint 2 — Academic core

`Status: Done` · `Last updated: 2026-08-01` · Duration: 2 weeks

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

**Everything shipped** — the committed backlog _and_ all three stretch items.

| Item                                              | PR  |
| ------------------------------------------------- | --- |
| S2-0a object storage                              | #19 |
| S2-0b cursor pagination                           | #20 |
| S2-1..S2-4, S2-6 academic content + notifications | #21 |
| S2-7 class feed · S2-8 notification bell          | #22 |
| S2-5 notices and events                           | #23 |
| S2-9 class timetables                             | #24 |
| S2-10 syllabus coverage                           | #25 |
| S2-11 role dashboards                             | #26 |

Tests grew from 268 to **479 API + 57 UI + 47 E2E**. The permission-matrix suite's `UNIMPLEMENTED`
inventory shrank from sixteen rows to eight: everything academic is now enforced test-for-test, and what
remains is leave, complaints, billing, and social — none of them built.

**The defect that mattered most.** Publishing homework was gated by `requireRole(actor, ['TEACHER'])`, which
reads the **role claim in the access token**. `FR-AUTH-001` creates every individual as `USER`, and approving a
verification writes a `membership` row rather than promoting the profile — so **no teacher who registered
through the product could ever publish**. The API suite missed it for 341 tests because every case hand-signs a
token carrying a role the real flow never issues. A browser walking register → verify → approve → publish found
it in minutes. Both academic policies now read the verified membership alone, which is what the permission
matrix always said; written up in [`../Security/02-authorization.md`](../Security/02-authorization.md).

**Two more gaps of the same shape — data the API simply would not tell you about yourself:**

- A verified student had no way to reach their own class. `/me` returns an account; `/schools/:id/members` is
  the school's roster and refuses individuals. Closed by `GET /me/memberships` (#22).
- A teacher's membership is school-wide and carries no class, so nothing told a teacher which classes they
  teach. Closed by `GET /me/subjects` (#26).

Both were invisible until someone tried to build the screen that needed them.

**An authorization hole found by a browser test, not by review.** Syllabus coverage was fetched one subject at
a time, so a class with _no_ subjects never reached a policy at all — a stranger could tell an empty class from
one that does not exist. `GET /classes/:id/syllabus` authorizes once, before any subject is looked at (#25).

**Test-infrastructure findings, both worth keeping:**

- A rare full-suite failure was **not** a wrong status code but a twenty-second hang in `beforeEach`. `TRUNCATE`
  needs `ACCESS EXCLUSIVE` on every table, so one connection left idle inside a transaction blocks the reset
  until the test timeout fires — and a reset that lands late wipes the fixture the next test just created,
  which is where the impossible-looking 403-became-404 results came from. The reset now runs under a five-second
  `lock_timeout` and names the connections still active. **What leaves a transaction open is still unknown.**
- Several E2E cases waited on a re-render after a Server Action. On a two-core runner those timed out with no
  API request logged for the whole twenty seconds — the action had been sent, only the revalidation was missing.
  Clicks now survive the hydration gap (`clickUntil`), and decisions assert against the database after a reload.

**Documentation drift, found by diffing rather than reading.** Comparing the registered Express routes against
[`../API/03-endpoints.md`](../API/03-endpoints.md) showed the timetable rows still describing the endpoints as
designed, `/media/:prefix` absent since S2-0a, and three institution routes missing. An earlier edit had matched
nothing because Prettier re-pads table columns when rows are added. Every registered route is now in the table;
that diff is worth running each sprint.

**Deviation recorded:** role dashboards are one composed `/home` rather than four role directories, because
roles are not exclusive — see [`../Architecture/03-frontend-architecture.md`](../Architecture/03-frontend-architecture.md).

**Carried into Sprint 3 unresolved:** asymmetric token signing + JWKS, alert routing, four unbuilt dashboards,
orphaned S3 objects, and the idle-transaction question above.

**Still open for the team, third sprint running:** branch protection does not _require_ the CI checks, and the
`development → main` release PR is still being squashed where [`../CI-CD/00-git-flow.md`](../CI-CD/00-git-flow.md)
specifies a merge commit.

## Retro

_To be completed by the team at the retro — went well / didn't / actions with owners and due dates._
