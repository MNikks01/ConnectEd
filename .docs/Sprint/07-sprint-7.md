# Sprint 7 — Events that cannot be lost, and the next phase's foundations

`Status: Active` · `Last updated: 2026-08-06` · Duration: 2 weeks

Goal: close the one durability gap the product actually has, and start whichever phase comes next
properly rather than by drifting into it. This is a **proposal for planning** — adjust the split
before committing.

## Sprint goal

> A notification that was meant to be sent is sent, or is retried until it is — never lost with only
> a log line to show for it. And the next phase has a written requirement before it has code.

## What makes this sprint different

**Commercialisation is blocked for a fourth sprint, and planning around it has stopped being
clever.** S5-0a became S6-0a and is now S7-0a. Sprint 5 shipped around it with a port and a fake;
Sprint 6 could not, and shipped its ungated half instead. That worked twice, but the plan should now
say plainly: **billing is not in this sprint unless the decision arrives in the first week.**

The correction in [`../PRD/10-completeness.md`](../PRD/10-completeness.md) matters for estimating.
There is no payment port and no fake — `apps/api/src/modules/billing` has one endpoint and no
payment abstraction at all. What exists is everything _around_ a provider. Checkout, webhooks,
invoices and the port they plug into are **a module to build, not an adapter to write.** Anyone
sizing S7-8…S7-11 from Sprint 5's experience will size them wrong.

So, as in Sprint 6: what needs a decision, and what starts on Monday regardless.

## Prerequisites — decisions, not work

| #     | Decision                                      | Blocks                  | Why it is not engineering's                                                                                                                          |
| ----- | --------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| S7-0a | **Stripe or Razorpay** (ADR-0015, carried ×3) | S7-8 … S7-11            | Follows the region of the pilot schools. Retro action A1 asks for a decision _or_ an explicit drop; a fourth silent carry is the outcome to avoid.   |
| S7-0b | **A mail transport** (carried)                | S7-12, S7-13            | SES, Postmark, SMTP — any. FR-AUTH-009 is built and undeliverable until one exists.                                                                  |
| S7-0c | ✅ **Decided 2026-08-07: the gradebook.**     | S7-5 … S7-7 (unblocked) | Answered by starting S7-5, and recorded at the top of `PRD/11-gradebook.md` so the decision is written down rather than implied by a file appearing. |

**S7-0c has a recommendation: the gradebook.** Mobile is a second client for an API that already
works; the gradebook is a capability the product does not have at all, and every school asks for it.
Mobile also drags in a store presence, a release train and push infrastructure, which is a phase and
not a sprint. If mobile is chosen anyway, the ungated half below is unaffected.

## Committed backlog (proposed)

**Ungated — starts regardless:**

| #     | Item                                                                                 | Owner            | Est. | DoD                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------ | ---------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S7-1  | **Transactional outbox** for domain events                                           | backend          | L    | Event row written in the _same transaction_ as the domain change; a relay drains it; a failed publish is retried, not dropped; sabotage test proves a lost publish is recovered |
| S7-2  | Retire the "publish and hope" path and its error log                                 | backend          | S    | `shared/queue` no longer swallows a failure; the only remaining loss path is documented or gone                                                                                 |
| S7-3  | Audit the release path for cases never exercised (retro **A3**)                      | devops           | M    | Each release-path check named, with the case it has never run against, and either a test or a written accepted risk                                                             |
| S7-4  | ✅ **Done 2026-08-06** — `docs/close-sprint-2` deleted, not merged (retro **A5**)    | technical-writer | S    | Nothing unmerged was ever in it — see below                                                                                                                                     |
| S7-17 | ✅ **Done 2026-08-06** — the whole E2E suite now runs the worker as a second process | devops           | M    | Found and fixed a bug on its first run; sabotage-verified against `worker.ts`                                                                                                   |

**S7-4 closed by deletion, and the reason is worth more than the branch was.**
`docs/close-sprint-2` was the source branch of PR #27, squash-merged on 2026-08-01. Its content was
already on `development` in full: the Sprint 2 doc had **zero** lines the branch did not, and the
Sprint 3 doc differed only in being the older, emptier version. Merging it would have deleted 31,265
lines — everything built in the five days since.

It looked like dangling work because **a squash merge does not record the branch as merged.** Git
sees its commit as unreachable from `development`, so `git branch --merged` omits it and "1 commit
ahead" is literally true. That is the same squash-versus-ancestry mechanic the git-flow doc warns
about for back-merges, turning up somewhere nobody was looking for it.

The lesson is cheap and general: **"unmerged" is a statement about ancestry, not about content.**
Diff before concluding that a stale branch holds work. This one was described as holding an unmerged
close-out for five days, and never held anything.

**S7-17 came out of S7-3 and is the reason that audit was worth doing.**
`RUN_WORKER_IN_PROCESS` appears in no workflow and no test configuration, so it is always its
default and every test runs the worker in-process. `apps/api/src/worker.ts` has therefore **never
been started by anything** — not by `verify`, not by `e2e`. It is the deployment the product is
meant to use when fan-out is heavy, and since ADR-0019 it is where the outbox relay lives in that
mode: relay wiring shipped into that file on 2026-08-06 and no test has executed a line of it.

A boot smoke test is the cheap version and would catch a typo. It would not catch the thing worth
catching, which is the relay running in one process while the API writes outbox rows in another —
so the DoD above asks for the real shape. See `../CI-CD/03-release-path-audit.md` finding 5.

**S7-0c is decided — these are no longer gated:**

| #    | Item                                                                    | Owner                 | Est. | DoD                                                                                                  |
| ---- | ----------------------------------------------------------------------- | --------------------- | ---- | ---------------------------------------------------------------------------------------------------- |
| S7-5 | ✅ **Done 2026-08-07** — `PRD/11-gradebook.md`, `Status: Draft`         | product + tech-writer | M    | FR-GRADE-001…023, three permission-matrix rows, and a per-role scoping table for who may see a mark  |
| S7-6 | ✅ **Done 2026-08-07** — assessments and marks, server-side             | backend               | L    | Transactional writes; ± permission tests; a student sees only their own; audit trail on every change |
| S7-7 | ✅ **Done 2026-08-07** — mark entry, and results for pupils and parents | frontend              | M    | Loading/error/empty/success/responsive/accessible; a parent sees their child and no other            |

**Gated on S7-0a — the billing module:**

| #     | Item                                      | Owner   | Est. | DoD                                                                                         |
| ----- | ----------------------------------------- | ------- | ---- | ------------------------------------------------------------------------------------------- |
| S7-8  | ADR-0015, the provider port, and its fake | backend | M    | The fake is what tests use; CI never reaches a third party's sandbox                        |
| S7-9  | Checkout and activation (FR-BILL-002)     | backend | M    | `trialing → active` only on a verified provider signal, never on a redirect                 |
| S7-10 | Webhook reconciliation (FR-BILL-004)      | backend | L    | Signature-verified; idempotent by provider event id; a late `active` cannot revive a cancel |
| S7-11 | Dunning (FR-BILL-005)                     | backend | M    | `past_due` grace period; fan-out; downgrade on cancel                                       |

**Gated on S7-0b — mail:**

| #     | Item                                  | Owner   | Est. | DoD                                                                            |
| ----- | ------------------------------------- | ------- | ---- | ------------------------------------------------------------------------------ |
| S7-12 | Mail transport behind a port          | backend | M    | A fake in tests; no live send from CI; bounces observable                      |
| S7-13 | Email verification gate (FR-AUTH-010) | backend | M    | **Ships only after S7-12.** Gating on an unsendable email locks out every user |

## Stretch (only if committed done)

| #     | Item                                                           | Owner   | Carried from |
| ----- | -------------------------------------------------------------- | ------- | ------------ |
| S7-14 | Invoices and billing history (FR-BILL-006, P2)                 | backend | S6-10        |
| S7-15 | Product-event analytics sink (`Product/02-metrics.md` funnels) | devops  | S6-12        |
| S7-16 | Push-token registration (FR-NOTIF-004), if mobile is chosen    | backend | —            |

## Dependencies / risks

- **An outbox is a second place the truth lives, and that is its whole danger.** The event row and
  the domain change commit together or not at all — that part is easy. The hard part is the relay:
  it must be idempotent, because it _will_ deliver twice, and it must not become a queue that
  silently lags. The existing `(event_id, recipient_id)` key already makes the consumer idempotent;
  the relay needs the same discipline and a metric on its depth.
- **Do not let the outbox become a second queue.** BullMQ stays the fan-out mechanism. The outbox
  exists to guarantee the handoff _into_ it survives a crash between commit and publish, and nothing
  more. A design that replaces the queue is a much larger change than this sprint.
- **A gradebook is the first feature where the product tells a child a number about themselves.**
  Everything so far has been logistics — homework, timetables, notices. Marks are different in kind:
  who may see one, how a correction is recorded, and whether a parent sees a sibling's are product
  questions with real consequences, and they belong in the PRD before they are in code. This is why
  S7-5 precedes S7-6 rather than accompanying it.
- **The billing estimate is not Sprint 5's estimate.** There is no port and no fake to extend; see
  above. If S7-0a arrives late in the sprint, take S7-8 alone and leave the rest.
- **A fourth carry of S7-0a is itself a risk to the roadmap**, not just to a sprint. Phase 5 has now
  been "current" for three sprints while the half that names it has not started.

## Ceremonies

Planning · daily async standup · backlog refinement · review · **retro, written in the room**
(action A4 — Sprint 6's was reconstructed from commits afterwards, which is better than nothing and
worse than a retro).

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI
green · reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Advertising on the consumer surface. The mobile client itself, unless S7-0c chooses it — and even
then, this sprint is its server-side prerequisites, not an app.

## Still open for the team

**Nothing on the CI or protection side, for the first sprint in seven.** Branch protection landed on
2026-08-06: both branches require a pull request and five passing checks and refuse force pushes.
No approving review is required, deliberately — one collaborator cannot approve their own pull
request. That is the thing to revisit when a second person joins, and it is the only open item left
from six sprints of "still open for the team".

## Review notes

**Shipped: the whole ungated half, and one item that did not exist at planning.**

| Item  | What                                                     | PR   |
| ----- | -------------------------------------------------------- | ---- |
| S7-1  | The transactional outbox — mechanism, relay, depth gauge | #100 |
| S7-2  | The remaining seven events; the publisher deleted        | #101 |
| S7-3  | The release path audited for cases never exercised       | #103 |
| S7-4  | `docs/close-sprint-2` closed out — by deletion           | #105 |
| S7-17 | The worker started in CI, as a second process            | #106 |

**Not shipped, and not startable.** S7-5 … S7-13 are all gated. S7-0a was not decided and is now
carried a fourth time; S7-0b and S7-0c were not decided either. The stretch items were not reached
and were never the point.

## The chain is the story

Each item made the next one visible, which is not how the sprint was planned — it is what happened.

The completeness audit named one real engineering gap: a domain event whose publish failed was lost.
Fixing it (S7-1, S7-2) produced a **new** failure mode — the relay is a process that must be
running — which was written into the completeness doc rather than left implied. Auditing the release
path (S7-3) then found that the process holding that new failure mode **had never been started by
any test**, which became S7-17. And S7-17, on its first run, found a defect that had already
shipped.

## The defect S7-17 found, because it is the argument for the whole sprint

`worker.ts` built its notifications module as `createNotificationsModule(db, logger)`. The audience
parameter is optional, so it type-checked. Without it nothing resolves class recipients, so in the
split deployment **every class fan-out reached nobody** — homework, notices, events — while
notifications naming a recipient directly still arrived. Half-working, which is why nothing looked
broken.

S7-3 had described this gap the day before as "a typo in that file would be found in production". It
was not a typo, and it was not theoretical for even a day.

## Three defects were introduced and caught inside the sprint

Worth recording, because a sprint that only lists what it fixed reads better than it was.

- **S7-1 shipped an unbounded `queue.add` in the relay.** The publisher it replaced had a two-second
  timeout for a documented reason — ioredis queues commands while disconnected rather than
  rejecting — and in the relay an unbounded add would hang a pass and the process shutdown with it.
  Caught in S7-2 by the test file the old contract left behind, which survives with its contract
  inverted rather than deleted.
- **`approve` took an event parameter and never recorded it.** An approval would have granted
  membership and told nobody. Caught by an existing test, with lint flagging the unused argument at
  the same moment.
- **A merge went through without `verify` green.** Cancelling a stuck CI run while an auto-merge
  gate was armed dropped the cancelled checks out of the list, and the gate merged on the two that
  remained. The content was a markdown file and post-merge CI was green, but the guarantee was not
  the one that had been described. The gate now refuses when fewer than five checks report.

## What the sprint says about the plan

Planning in two halves worked for the third sprint running, and it should stop being described as a
clever trick. It is simply what a plan looks like when part of the work depends on somebody else's
decision.

The fourth carry of S7-0a is the thing to take to planning. Three sprints of ungated work have now
been found to fill the gap; there is no reason to assume a fourth will be there.

## Retro

_Written at the retro, in the room — see action A4._
