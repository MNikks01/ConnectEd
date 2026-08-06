# Sprint 7 — Events that cannot be lost, and the next phase's foundations

`Status: Planned` · `Last updated: 2026-08-06` · Duration: 2 weeks

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

| #     | Decision                                       | Blocks       | Why it is not engineering's                                                                                                                                    |
| ----- | ---------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S7-0a | **Stripe or Razorpay** (ADR-0015, carried ×3)  | S7-8 … S7-11 | Follows the region of the pilot schools. Retro action A1 asks for a decision _or_ an explicit drop; a fourth silent carry is the outcome to avoid.             |
| S7-0b | **A mail transport** (carried)                 | S7-12, S7-13 | SES, Postmark, SMTP — any. FR-AUTH-009 is built and undeliverable until one exists.                                                                            |
| S7-0c | **Gradebook or mobile — which phase is next?** | S7-5 … S7-7  | Both sit under "later phases" in the roadmap with no order between them. Deciding this _is_ deciding what the second half of this sprint and the next one are. |

**S7-0c has a recommendation: the gradebook.** Mobile is a second client for an API that already
works; the gradebook is a capability the product does not have at all, and every school asks for it.
Mobile also drags in a store presence, a release train and push infrastructure, which is a phase and
not a sprint. If mobile is chosen anyway, the ungated half below is unaffected.

## Committed backlog (proposed)

**Ungated — starts regardless:**

| #     | Item                                                            | Owner            | Est. | DoD                                                                                                                                                                             |
| ----- | --------------------------------------------------------------- | ---------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S7-1  | **Transactional outbox** for domain events                      | backend          | L    | Event row written in the _same transaction_ as the domain change; a relay drains it; a failed publish is retried, not dropped; sabotage test proves a lost publish is recovered |
| S7-2  | Retire the "publish and hope" path and its error log            | backend          | S    | `shared/queue` no longer swallows a failure; the only remaining loss path is documented or gone                                                                                 |
| S7-3  | Audit the release path for cases never exercised (retro **A3**) | devops           | M    | Each release-path check named, with the case it has never run against, and either a test or a written accepted risk                                                             |
| S7-4  | Close out `docs/close-sprint-2` (retro **A5**)                  | technical-writer | S    | Merged or deleted with a reason; nothing unmerged left dangling from 2026-08-01                                                                                                 |
| S7-17 | **Start `worker.ts` in CI** — it has never been started at all  | devops           | M    | A run with `RUN_WORKER_IN_PROCESS=false` and the worker as a second process; an event published by the API is delivered by it. Deleting a line from `worker.ts` fails it        |

**S7-17 came out of S7-3 and is the reason that audit was worth doing.**
`RUN_WORKER_IN_PROCESS` appears in no workflow and no test configuration, so it is always its
default and every test runs the worker in-process. `apps/api/src/worker.ts` has therefore **never
been started by anything** — not by `verify`, not by `e2e`. It is the deployment the product is
meant to use when fan-out is heavy, and since ADR-0019 it is where the outbox relay lives in that
mode: relay wiring shipped into that file on 2026-08-06 and no test has executed a line of it.

A boot smoke test is the cheap version and would catch a typo. It would not catch the thing worth
catching, which is the relay running in one process while the API writes outbox rows in another —
so the DoD above asks for the real shape. See `../CI-CD/03-release-path-audit.md` finding 5.

**Gated on S7-0c, if the gradebook:**

| #    | Item                                                      | Owner                 | Est. | DoD                                                                                                       |
| ---- | --------------------------------------------------------- | --------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| S7-5 | `PRD/11-gradebook.md` — requirements before code          | product + tech-writer | M    | `FR-GRADE-` ids, permission-matrix rows for all seven roles, and an explicit answer on who may see a mark |
| S7-6 | Assessments and marks, server-side                        | backend               | L    | Transactional writes; ± permission tests; a student sees only their own; audit trail on every change      |
| S7-7 | Mark entry for teachers, results for students and parents | frontend              | M    | Loading/error/empty/success/responsive/accessible; a parent sees their child and no other                 |

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

_Filled at review._

## Retro

_Written at the retro, in the room — see action A4._
