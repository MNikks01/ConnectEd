# Sprint 3 — Workflows

`Status: Planned` · `Last updated: 2026-08-01` · Duration: 2 weeks

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

_Filled at sprint review._

## Retro

_Filled at retro._
