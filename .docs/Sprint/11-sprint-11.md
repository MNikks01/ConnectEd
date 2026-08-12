# Sprint 11 — The sprint a school writes for us

`Status: Planned` · `Last updated: 2026-08-12` · Duration: 2 weeks

**Read the next section before the backlog.** This plan is written two sprints ahead of a decision
that gates both of them, so it branches rather than pretends. Delete the branch that does not happen.

## The honesty this plan has to open with

**Sprint 10 has not run.** It is `Planned`, every one of its eight items is the deployment, and it
cannot start until [B-1](../Product/05-what-is-blocked-on-you.md#b-1--where-production-runs) is
answered. Planning Sprint 11 concretely would mean inventing the outcome of a sprint that has not
begun, on top of a decision nobody has made.

So this is two plans. **Branch A** is Sprint 11 if Sprint 10 ran. **Branch B** is Sprint 11 if it did
not, and B is the one worth reading carefully, because a second consecutive blocked sprint is a
different situation from the first and should not be handled the same way.

There is no third branch where engineering invents work. Sprint 10 already argued that case and it
has not weakened: more features on a product that has never been deployed increases the amount of
untested-in-reality software and reduces nothing.

---

# Branch A — Sprint 10 ran, and something is deployed

## Sprint goal

> A school that does not work here uses this product for a fortnight, and we fix what that finds.

## What makes this sprint different from the ten before it

**Every sprint so far has been graded by us.** The tests we wrote passed, against the data we seeded,
on the machine we configured. Sprint 11 is the first where the grader is somebody who has never seen
the codebase and does not care how it works.

**This changes what a plan can honestly contain.** The first fortnight of real use generates its own
backlog, and that backlog is more valuable than anything written here in advance — it is the only
list in this project's history that was not written by the person implementing it.

**So half of this sprint is deliberately unallocated.** Six committed items, and the rest of capacity
reserved for what the school finds. A full sprint board here would guarantee one of two outcomes: the
school's findings get deferred, or the board becomes fiction in week one. Sprint 9 committed nine
items against a warning that deployment work finds unknowns, and finished four of them half-done.
That is the evidence for this being a plan and not a mood.

## Prerequisites

| #     | Needed                     | For              | Note                                                                   |
| ----- | -------------------------- | ---------------- | ---------------------------------------------------------------------- |
| —     | **A pilot school, agreed** | the whole sprint | The sprint has no subject without one. Not an engineering task         |
| B-4   | Retention                  | S11-5            | Asked in three PRDs. Real pupil data makes the wrong answer expensive  |
| B-7.6 | An error-tracking account  | S11-2            | The observability stack is built; nothing collects from a deployed app |
| B-15  | A Hindi reader             | S11-7            | Only if the pilot is Indian, in which case it is not optional          |

## Committed backlog

| #     | Item                                                     | Owner   | Est. | DoD                                                                                                                                                                    |
| ----- | -------------------------------------------------------- | ------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S11-1 | **Onboard the pilot school with their real data**        | backend | L    | Their classes, subjects, staff and pupils — imported or entered, by them where possible. Every defect this surfaces is logged, not fixed silently                      |
| S11-2 | **Something pages a person**                             | devops  | M    | Alertmanager routing to a real destination, plus error tracking from the deployed app. Proven by breaking production on purpose out of hours                           |
| S11-3 | **The north star, computed and visible**                 | backend | M    | `product_event` → a queryable sink → Weekly Active Verified Members per school, on a dashboard. The metric the product chose to be judged by, finally showing a number |
| S11-4 | **A restore drill against the pilot's own backup**       | devops  | M    | S10-5 proved the mechanism. This proves it on data whose loss would matter, and records the wall-clock time it took                                                    |
| S11-5 | **Retention implemented**, once B-4 lands                | backend | M    | Policy in the schema, scheduled purge, and the same disposition machinery erasure already uses                                                                         |
| S11-6 | **The first-contact defect list, triaged and published** | product | S    | Everything S11-1 surfaced, categorised as fix-now / fix-later / working-as-intended, with the working-as-intended ones justified in writing                            |

**Reserved: roughly half of capacity, unallocated, for what the school finds.** If it goes unused,
that is a finding in itself and the stretch list absorbs it.

## Stretch (only if committed done)

| #      | Item                             | Note                                                                  |
| ------ | -------------------------------- | --------------------------------------------------------------------- |
| S11-7  | The Hindi read, applied (B-15)   | If the pilot is Indian this belongs in the committed list, not here   |
| S11-8  | Breached-password check (B-14)   | One place: the shared password schema                                 |
| S11-9  | The four product questions (B-6) | A real school makes B-6.2 and B-6.3 concrete rather than hypothetical |
| S11-10 | Human accessibility audit (B-13) | A pilot with real pupils is when this stops being a checkbox          |

## Definition of Done — one addition

Unchanged, plus: **an item touching the pilot is done when somebody who does not work here has done
it, unaided, and we watched.** Not "it works" — "they did it". Every usability defect this project
has is currently invisible for exactly one reason, which is that its only user wrote it.

---

# Branch B — B-1 is still unanswered

## Sprint goal

> **There isn't one, and saying so is the deliverable.**

## Why this branch is not a repeat of Sprint 10's

Sprint 10 said: if B-1 is unanswered, do not fill the sprint, and it offered three options — wait,
answer the people-shaped items, or start the mobile client as an explicit phase.

**Waiting was a reasonable answer once. It is a decision the second time.** A project whose
engineering has been complete for two sprints, and which is not being deployed, is not blocked — it
is finished pending a choice about whether it continues. That is worth saying plainly rather than
absorbing into a third sprint of the same shape.

## The three options, and what I would argue for now

| Option                           | What it means in Sprint 11                                                                                                                        | My view                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Commit to the mobile phase**   | B-11 becomes a real phase with its own planning, ADRs and a client. It is the only substantial buildable thing left, and FR-NOTIF-004 waits on it | **Recommended** if the project is continuing         |
| **Stop the engineering cadence** | No sprint. The repository is complete and documented; it waits, and nobody pretends otherwise                                                     | Correct if the pilot is not real yet                 |
| **A third blocked sprint**       | Plan something, half-do it, carry the rest                                                                                                        | The one option that costs something and buys nothing |

**The people-shaped items are not a sprint.** B-8 (a reviewer), B-15 (a Hindi reader), B-13 (an
accessibility auditor) are all worth doing and none is engineering work — they belong in whichever
branch happens, not as filler that makes an empty sprint look full.

## If the mobile phase is chosen — what Sprint 11 actually is

A phase kickoff, not a feature sprint. Four items, all decisions and scaffolding:

| #      | Item                                                           | Owner    | Est. | DoD                                                                                                        |
| ------ | -------------------------------------------------------------- | -------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| S11-B1 | **An ADR choosing the mobile stack**                           | frontend | M    | React Native / Expo / native, argued against this product's constraints — offline registers, push, one API |
| S11-B2 | **The client scaffolded, authenticating against the real API** | frontend | L    | Sign in, token refresh, and a verified member seeing one real screen. Nothing else                         |
| S11-B3 | **FR-NOTIF-004 — push tokens, end to end**                     | backend  | M    | The one functional requirement the mobile phase unblocks. Registration, delivery, revocation on sign-out   |
| S11-B4 | **What the mobile client may not do**, written down            | backend  | S    | Institution accounts stay web-only. The authorization model does not get a second implementation           |

**S11-B4 is the load-bearing one.** The single rule that defines this product is that authorization
is server-enforced. A mobile client is the most likely place in this project's future for that to be
quietly re-implemented on a device, and the time to write the boundary down is before there is a
client arguing for an exception.

---

## Dependencies / risks — both branches

- **A pilot school is a person's commitment, not a resource.** Branch A assumes one exists and has
  agreed to a fortnight of being the first user of software that has never been used. If that
  conversation has not happened, Branch A is fiction regardless of whether B-1 was answered.

- **Branch A's reserved capacity will be under pressure to fill.** It will look like slack in week
  one. It is not; it is the only budget for the findings this sprint exists to produce.

- **Still no second reviewer.** Eleven sprints. Branch A ships changes against real pupil data and
  Branch B would start a whole new client — both are worse places than usual to have one pair of
  eyes. B-8 has now demonstrably cost something: three sprints spent carrying an action that one
  person could not complete, closed as failed on 2026-08-12.

- **A test asserted on text rather than shape and failed a green branch** (2026-08-12,
  `gradebook.test.ts`). It was fixed, but the class of defect — a substring check over serialised
  JSON colliding with a timestamp — is worth a pass over any new assertions this sprint adds,
  particularly in a mobile client where payloads get serialised more, not less.

## Ceremonies

Planning · daily async standup · backlog refinement · review · **retro written from the record at
close, in the PR that closes the sprint, labelled as a reconstruction** — Sprint 9's A1, which
replaced A4 after it failed three times. If B-8 is answered before this sprint closes, hold the
ceremony version instead and say so.

## Definition of Done (item-level)

Code + tests (including positive **and** negative permission tests for new endpoints) · CI green ·
reviewed · changeset · docs/ADR updated · feature states (loading/error/empty/success/responsive/
a11y) · **and a route a person can reach it by** (Sprint 8's addition) · **and, for infrastructure,
destroyed and recreated from scratch** (Sprint 10's).

## Review notes

_Filled at review._

## Retro

_Written from the record at sprint close, in the PR that closes the sprint, labelled as a
reconstruction — see Sprint 9's action A1._
