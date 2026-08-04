# Sprint 3 — Workflows

`Status: Done` · `Last updated: 2026-08-02` · Duration: 2 weeks

Goal: the two request-and-decision chains a school runs every week — leave and complaints. Maps to roadmap
**Phase 3**. This is a **proposal for planning** — adjust the split before committing.

## Sprint goal

> A parent applies for their child's leave and the class teacher of that class — and nobody else — decides it.
> A teacher applies for their own and the principal decides. Either applicant sees the outcome and is notified.
> A parent or teacher raises a complaint and the school reviews it.

Both chains are the first workflows where **who may decide** depends on an allocation rather than a role:
`assertClassTeacherOf` and `assertPrincipalOfSchool` already exist and have never been used by an endpoint.

## Prerequisites

None. Unlike Sprint 2, nothing is missing from the platform: `leave_application` and `feedback` are in the
schema, both policies are written and unit-tested, notifications fan out, and the portal has the shapes these
screens need. This sprint is the first that is purely product work.

## Committed backlog (proposed)

| #    | Item                                                                | Owner (agent) | Est. | DoD                                                                                      |
| ---- | ------------------------------------------------------------------- | ------------- | ---- | ---------------------------------------------------------------------------------------- |
| S3-1 | Parent applies for a verified child's leave (FR-WF-001)             | backend       | M    | Enters the child's class-teacher queue; a parent cannot apply for another's child        |
| S3-2 | Teacher applies for their own leave (FR-WF-002)                     | backend       | S    | Enters the principal's queue; kind derived server-side, never from the request           |
| S3-3 | Class teacher decides student/parent leave (FR-WF-003)              | backend       | M    | **Their allocated class only**; ± permission tests; decision + decider audited           |
| S3-4 | Principal decides teacher leave (FR-WF-004)                         | backend       | M    | Principal of that school only; a class teacher must be refused; audited                  |
| S3-5 | Applicant sees status; notified on decision (FR-WF-005)             | backend       | S    | `leave.decided` event; notification idempotent by `(event_id, recipient_id)`             |
| S3-6 | School/principal read-only oversight of class queues (FR-WF-006)    | backend       | S    | View-only: an oversight read must not be able to decide                                  |
| S3-7 | Complaints and suggestions: submit and review (FR-WF-010, 011, 012) | backend       | M    | Parent/teacher/principal submit; school and principal review; teachers view only         |
| S3-8 | Leave in the web app — apply, queue, decide                         | frontend      | L    | Parent and teacher forms; a decision queue for class teacher and principal; all 6 states |
| S3-9 | Complaints in the web app — submit and review                       | frontend      | M    | Submission form; school review list with status; all 6 states                            |

**Students are hidden from both modules** (carried from legacy, and restated in the permission matrix). Hidden
in the UI _and_ refused by the server — the matrix rows are `➖`, not `👁`.

## Stretch (only if committed done)

| #     | Item                                                                     | Owner   |
| ----- | ------------------------------------------------------------------------ | ------- |
| S3-10 | Asymmetric token signing (RS256/EdDSA) + JWKS — carried since Sprint 0   | backend |
| S3-11 | Alert routing for the Prometheus rules that currently fire into the void | devops  |
| S3-12 | Orphaned object collection for uploads whose attach failed               | backend |

## Dependencies / risks

- **`assertClassTeacherOf` and `assertPrincipalOfSchool` have never been exercised by an endpoint.** They are
  unit-tested against the fixture, which is not the same as being right in a request. Expect the first
  integration test of each to find something, as S2-1 did with `assertTeacherAllocatedToSubject`.
- **A class with no class teacher cannot approve leave at all.** The portal already warns about this; the API
  must answer it as a stated condition rather than an empty queue that looks like "nothing to do".
- **Leave spans dates, and dates are not timestamps.** `start_date`/`end_date` are `@db.Date`; a timezone
  applied on the way in will move a leave day for a school in `Asia/Kolkata`. Decide the contract once, in
  `API/01-conventions.md`, before either endpoint is written.
- **The eight remaining `UNIMPLEMENTED` matrix rows are mostly this sprint.** Four of them — submit leave,
  approve student/parent leave, approve teacher leave, submit and review complaints — should move into the
  enforced table here. Adding an endpoint without its matrix row is what let two academic rows sit in the
  inventory for a whole sprint after they shipped.
- **Carried, still unresolved:** what leaves a database transaction open during the API test suite. It is now
  loud rather than silent, but the cause is unknown and it will keep costing a rerun until someone finds it.

## Ceremonies

Planning · daily async standup · backlog refinement · review · retro.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI green ·
reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Social — Phase 4. Billing — Phase 5. Push notifications — mobile phase.

## Review notes

**Everything shipped** — the committed backlog _and_ all three stretch items, which closes every carry-over
from Sprints 0–2.

| Item                                               | PR  |
| -------------------------------------------------- | --- |
| S3-1..S3-6 leave applications                      | #31 |
| S3-7 complaints and suggestions                    | #32 |
| S3-8, S3-9 leave and complaints in the web app     | #33 |
| S3-10 Ed25519 tokens + JWKS (carried from S0)      | #34 |
| S3-11 alert routing (carried from S1)              | #35 |
| S3-12 orphaned upload collection (carried from S2) | #36 |

Tests grew from 479 to **603 API + 57 UI + 54 E2E**. The permission-matrix inventory is down to **three rows**,
all social and billing — every academic and workflow capability in the product contract is now asserted against
the live API.

**The prediction that did not come true, and what was done about it.** The plan expected the first integration
test of `assertClassTeacherOf` and `assertPrincipalOfSchool` to find something, as S2-1 had. It did not — so the
tests were checked instead: sabotaging all five guards in the leave module fails 20 of its 39 cases, including
the one the feature turns on (a class teacher deciding leave for a class that is not theirs). A prediction that
misses is worth recording either way; the useful part is that "no bug found" was verified rather than assumed.

**A pattern named after three instances.** `/me/class-teacher` (#33) was the third endpoint added because the
API could not answer "what is mine?" — after `/me/memberships` for students (#22) and `/me/subjects` for
teachers (#26). The cause is structural: every endpoint is scoped from the resource inward — class, school,
subject — so a screen that starts from the person has nothing to ask. **Worth a `/me/*` convention in
`API/01-conventions.md` before the next module repeats it a fourth time.**

**The date contract, settled before it could bite.** The plan flagged that `start_date`/`end_date` are `@db.Date`
and that a timezone applied on the way in would move a leave day. `API/01-conventions.md` now distinguishes
instants from calendar dates, and a timestamp sent where a calendar date belongs is **rejected rather than
coerced** — `2026-09-14T00:00:00Z` is the 13th of September west of Greenwich.

**Two carry-overs turned out to be worse than recorded.**

- Prometheus had alert rules and **no `alerting:` block at all**, so every rule evaluated and fired into
  nothing. Every alert also linked to the runbooks _folder_ rather than a page, and none carried the label
  routing would key on. `scripts/check-alerts.mjs` now fails CI on either, because `promtool` validates PromQL
  and has nothing to say about whether an alert has somewhere to go.
- Neither `main` nor `development` is protected **at all** — `GET /branches/{name}/protection` returns 404 on
  both, which is stronger than the "does not require CI checks" reported after Sprints 1 and 2.

**A test that says what it does not prove.** `refuses an HS256 token when configured for EdDSA` still passes
with the algorithm pin removed, because jose will not use an Ed25519 key object as an HMAC secret in the first
place. Found by sabotaging the pin and watching nothing fail. The comment says so, and the pin stays as a
statement of intent — a green check should not imply a guarantee it is not giving.

**The release process, repaired.** The `development → main` release PR came out `CONFLICTING` across 176 files:
PR #8 had been squashed, so `main`'s only commit recreated every file as a fresh addition and git saw both
branches adding the same files independently. A back-merge (#30) restored the shared ancestor, and the release
(#28) went out as a merge commit — the first one that preserves the boundary. The same squash had also
resurrected a file deleted in #22, which would have broken the Next build with two pages claiming `/home`.

**Test-infrastructure work, all of it caused by real failures:** the API suite's intermittent hang was diagnosed
as a blocked `TRUNCATE` and now fails fast naming the blocking connection; every Server-Action E2E case now
asserts against the database after a reload rather than waiting on a re-render; and setup calls in three suites
assert their own success so a failure names its own step.

**Carried into Sprint 4:** four unbuilt dashboards (only `service-overview` exists), the metrics that would make
queue and business alerts writable, and the unknown cause of the idle transaction that blocks the test reset.

**Still open for the team, fourth sprint running:** branch protection.

## Retro

_To be completed by the team at the retro — went well / didn't / actions with owners and due dates._
