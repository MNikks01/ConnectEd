# Sprint 6 — Finishing commercialisation, and the console

`Status: Planned` · `Last updated: 2026-08-04` · Duration: 2 weeks

Goal: the half of Phase 5 that did not ship, plus the console the product has needed since it
started collecting reports. This is a **proposal for planning** — adjust the split before
committing.

## Sprint goal

> A school can pay us without an email, and what it pays for is reconciled from the provider rather
> than from a browser redirect. Somebody, somewhere, reads the reports children file.

## What makes this sprint different

**Most of it is blocked on two decisions, and pretending otherwise would waste a sprint.** Sprint 5
planned around one of them successfully — the provider port and its fake meant S5-1 to S5-3 shipped
without knowing the answer — but that trick has run out. Checkout, webhooks and dunning _are_ the
provider integration; there is nothing left to abstract.

So this plan is deliberately in two halves: **what needs a decision first**, and **what can start
on Monday morning regardless**. If the decisions do not arrive, the second half is the sprint.

## Prerequisites — decisions, not work

| #     | Decision                                                         | Blocks                 | Why it is not engineering's                                                                                                                                |
| ----- | ---------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S6-0a | **Stripe or Razorpay** (ADR-0015, carried from S5-0a)            | S6-1, S6-2, S6-3, S6-4 | Follows the region of the pilot schools. Legacy was India-first, which points at Razorpay; global ambition points the other way.                           |
| S6-0b | **What the plans actually limit** (carried from S5-0b)           | Nothing technical      | The catalogue ships provisional numbers — trial 5/200, standard 40/1500, premium unlimited — flagged as provisional in three places. Pricing is product's. |
| S6-0c | **Who reads the report queue** (carried from `PRD/06-social.md`) | S6-5, S6-6             | A school moderates its own community, but social spans schools and there is no platform-admin role. Deciding this _is_ deciding what the console is.       |

**S6-0c has a recommendation.** A **platform-admin** role, held by ConnectEd staff, scoped to the
moderation queue and nothing else. Not the school: a report is often _about_ someone at the
reporter's school, and the product already promises "nobody at your school is told". Not the
principal, for the same reason. If that is right, it is an ADR and a matrix row, and the console is
where it lives.

## Committed backlog (proposed)

**Gated on S6-0a** — cannot start without the provider chosen:

| #    | Item                                                       | Owner   | Est. | DoD                                                                                         |
| ---- | ---------------------------------------------------------- | ------- | ---- | ------------------------------------------------------------------------------------------- |
| S6-1 | ADR-0015 and the provider adapter behind the existing port | backend | M    | The fake stays and stays used in tests; CI never reaches a third party's sandbox            |
| S6-2 | Checkout and activation (FR-BILL-002)                      | backend | M    | `trialing → active` only on a verified provider signal, never on a redirect                 |
| S6-3 | Webhook reconciliation (FR-BILL-004)                       | backend | M    | Signature-verified; idempotent by provider event id; a late `active` cannot revive a cancel |
| S6-4 | Dunning (FR-BILL-005)                                      | backend | M    | `past_due` grace period; notification fan-out; downgrade on cancel                          |

**Gated on S6-0c**:

| #    | Item                                         | Owner   | Est. | DoD                                                                          |
| ---- | -------------------------------------------- | ------- | ---- | ---------------------------------------------------------------------------- |
| S6-5 | Platform-admin role, ADR, and its matrix row | backend | M    | Scoped to moderation; ± permission tests; the inventory returns to zero      |
| S6-6 | The moderation queue, and acting on a report | backend | L    | List, triage, resolve; every decision audited; a reporter is never disclosed |

**Ungated — starts regardless:**

| #    | Item                                                        | Owner    | Est. | DoD                                                                       |
| ---- | ----------------------------------------------------------- | -------- | ---- | ------------------------------------------------------------------------- |
| S6-7 | School analytics behind the `advancedAnalytics` entitlement | backend  | L    | The first feature flag that gates a _feature_ rather than a count         |
| S6-8 | The analytics view in the school portal                     | frontend | M    | Premium sees it; the rest are told what would unlock it, not shown a wall |
| S6-9 | Upgrade the release-tag annotation to the release body      | devops   | S    | Reads the merged commit rather than the merge commit's one-line subject   |

## Stretch (only if committed done)

| #     | Item                                                           | Owner   | Carried from |
| ----- | -------------------------------------------------------------- | ------- | ------------ |
| S6-10 | Invoices and billing history (FR-BILL-006, P2)                 | backend | S5-9         |
| S6-11 | Prove or disprove the test-suite flake                         | backend | S5-12        |
| S6-12 | Product-event analytics sink (`Product/02-metrics.md` funnels) | devops  | —            |

## Dependencies / risks

- **`advancedAnalytics` currently gates nothing, and that is the interesting part.** Every
  entitlement enforced so far is a _count_ — classes, members — refused at the write that would
  exceed it. A feature flag is a different shape: there is no write to intercept, so the check moves
  to the read, and "reads are never gated" (S5-3) suddenly has an exception. Decide deliberately
  where that check lives before S6-7, and say in the PRD why analytics is allowed to be the
  exception when a timetable is not.
- **A school below premium must be told what it is missing, not shown a broken page.** The billing
  page already sets this tone: no upgrade button while there is nothing behind it. An empty chart
  with no explanation is the same mistake in a different costume.
- **Moderation is the first destructive capability in the product.** Everything so far creates,
  edits, or soft-deletes something the actor owns. Acting on a report means acting on someone
  _else's_ content, and the audit trail is not a nice-to-have — it is the only thing that makes the
  power reviewable. `AuditLog` exists and has carried verification and leave decisions since S1.
- **A reporter must never be disclosed to the person they reported.** This is the promise the UI
  already makes in as many words. It constrains the queue's DTOs, not just its UI.
- **Webhook idempotency is not event idempotency.** The queue's `(event_id, recipient_id)` key is
  ours. The provider's is theirs, arrives more than once by design, and can arrive out of order.
- **Nothing in this product currently charges anyone, and that is a property of the tests.** The
  provider port must keep its fake, or CI acquires a dependency on a third party's sandbox — which
  will be down on the morning of a release.

## Ceremonies

Planning · daily async standup · backlog refinement · review · retro.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI
green · reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Push notifications and the mobile app — mobile phase. Gradebook and report cards — later. Advertising
on the consumer surface — later.

## Still open for the team, sixth sprint running

**Branch protection.** Neither `main` nor `development` requires a review or a passing check. A
production release and four follow-ups were merged in Sprint 5 by one pair of eyes, and nothing in
the repository would have stopped a bad one.

## Review notes

**S6-13, unplanned — one of the two flakes turned out not to be one.** `social.spec.ts`'s
`connections and messages` failed at roughly one run in four, and had been read as another sighting
of the long-running flake in S5-12/S6-11 — an action that returns 200 and is absent from the read
after it.

It was not that. It was a test asserting on text that two different pages both show. The inbox
renders each thread's last message as a preview, so the assertion meant to prove the conversation
had opened was already satisfied by the list behind it; the `goto` that followed then cancelled the
navigation before the page rendered, and rendering that page **is** the read (FR-SOC-021). The API
never saw it. Thirty runs green after waiting for the composer instead, against four failures in ten
before.

Worth separating in the record, because the two failures look identical from the outside and only
one of them is a product question. The other — wrong data in the API's vitest suite, locally only —
is untouched by this and still open.

**S6-11 answered — the suite flake was the reset, not the product.** It reproduces on demand: run
the end-to-end suite in a loop while the API suite runs. Different databases on the same Postgres,
so no interference — only contention. Two quiet runs passed; the first overlapping run failed three
tests.

Two of the three were `resetDb`. Its TRUNCATE ran inside a Prisma interactive transaction whose
default budget is 5000 ms, the same five seconds as the lock timeout it sets for itself. On a busy
machine the truncate took eleven seconds _unblocked_, and the commit was then refused as expired.
The reset rolled back, and the diagnostics written for exactly this case could never print, because
there was no blocker to name. The transaction now gets fifteen seconds and the lock timeout stays at
five.

The third was a supertest request answered with `400 WebSockets request was expected` — a string
that exists nowhere in this repository or its dependencies. It is in the Node binary, next to the
V8 inspector's UUID. The request reached a debugger port: an ephemeral-port collision under load,
not a product fault, and worth recognising on sight because it reads like one.

Not claimed: that this explains every past sighting. The reports of a row created and then absent
are a different shape, and are still open.

**Measured rather than assumed, twice this sprint.** The same test was suspected of being broken by
the Next 16.3 bump; ten runs on each version (four failures against two) said otherwise, and the
real cause was in the test all along.

## Retro

_Filled at retro._
