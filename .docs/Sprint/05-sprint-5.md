# Sprint 5 — Commercialisation

`Status: Planned` · `Last updated: 2026-08-02` · Duration: 2 weeks

Goal: the school pays, and paying means something. Maps to roadmap **Phase 5**. This is a **proposal for
planning** — adjust the split before committing.

## Sprint goal

> A school registers and is on a trial without asking. When the trial ends it subscribes, and what its plan
> allows is enforced by the API rather than described in a price list. Failed payment degrades gracefully and
> tells someone.

## What makes this sprint different

Every check the API makes today answers **"may you?"** — role, verification, ownership. Billing introduces a
second, orthogonal question: **"has your school paid for this?"** They fail differently and must not be
conflated.

- **404-over-403 does not apply to entitlements.** The rule exists so an attacker cannot map what exists by
  reading error codes. A principal who has hit their plan's class limit is not an attacker — they are a
  customer, and hiding the reason is both user-hostile and commercially absurd. Entitlement failures are
  **`402`/`403` with the limit, the current usage, and what lifts it**, named explicitly in the error model.
- **Entitlements are a property of the school, not the caller.** `assertVerifiedMemberOfSchool` answers who you
  are; entitlement answers what your school bought. A teacher blocked by a limit did nothing wrong, and the
  message should not read as though they did.
- **This is the first module with an external party that writes to us.** Webhooks are an inbound, unauthenticated
  (signature-verified) write path — the opposite direction from every integration so far.

## Prerequisites

| #     | Item                                                                                  | Why it blocks                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S5-0a | **ADR-0015: payment provider** — Stripe or Razorpay (`PRD/08-billing.md` defers this) | A commercial decision, not a technical one: it follows the region of the pilot schools. The legacy product was India-first, which points at Razorpay; global ambitions point at Stripe. **Needs the team, not an engineer.** |
| S5-0b | **A plan catalogue** — what the tiers are, what each limits                           | `FR-BILL-003` says entitlements gate "max classes, max members, advanced analytics". Nobody has said what the numbers are. Pricing is a product decision and the code cannot invent it.                                      |

**Neither blocks the sprint starting.** S5-1..S5-3 are provider-agnostic — the provider sits behind a port
(`PaymentProvider`) with a fake in tests, exactly as storage did. Limits come from a seeded plan table, so
changing a number is a migration and not a deploy. But **S5-4 onward cannot land without S5-0a**, and shipping
a checkout against the wrong provider is a week thrown away.

## Committed backlog (proposed)

| #    | Item                                                           | Owner (agent) | Est. | DoD                                                                                            |
| ---- | -------------------------------------------------------------- | ------------- | ---- | ---------------------------------------------------------------------------------------------- |
| S5-1 | Plans and subscriptions: schema, seeded catalogue              | backend       | M    | `Plan`, `Subscription`, `Entitlement` resolution; status enum matches the PRD                  |
| S5-2 | Trial on registration (FR-BILL-001, **P0**)                    | backend       | S    | Created in the **same transaction** as the school; a school can never exist without one        |
| S5-3 | Entitlement enforcement (FR-BILL-003)                          | backend       | L    | Limits enforced at the write; `402` names limit + usage; ± tests per gated endpoint            |
| S5-4 | Checkout and activation (FR-BILL-002)                          | backend       | M    | Provider session; `trialing → active` only on a verified provider signal, never on a redirect  |
| S5-5 | Webhook reconciliation (FR-BILL-004)                           | backend       | M    | Signature-verified; **idempotent by provider event id**; out-of-order events cannot regress    |
| S5-6 | Dunning (FR-BILL-005)                                          | backend       | M    | `past_due` grace period; notification fan-out; downgrade on cancel; grace period is a constant |
| S5-7 | Billing in the web app — the school account only               | frontend      | M    | Plan, usage against each limit, upgrade, and what happens at the end of a trial                |
| S5-8 | The last permission-matrix row (`Manage subscription/billing`) | backend       | S    | School `✅`, six `➖` — **including the principal**; inventory reaches zero                    |

## Stretch (only if committed done)

| #     | Item                                                             | Owner   | Carried from |
| ----- | ---------------------------------------------------------------- | ------- | ------------ |
| S5-9  | Invoices and billing history (FR-BILL-006, P2)                   | backend | —            |
| S5-10 | The four unbuilt dashboards, and the metrics they need           | devops  | S4-10        |
| S5-11 | Real-time message delivery over websockets (FR-SOC-022)          | backend | S4-11        |
| S5-12 | Find the idle transaction that blocks the API test suite's reset | backend | S4-12        |

S5-10 and S5-11 have now been deferred twice. Either commit one of them this sprint or drop it from the
roadmap — a stretch list that only grows is a backlog pretending to be a plan.

## Dependencies / risks

- **A limit enforced only on create is not a limit.** A school on a plan capped at ten classes that already has
  fifty — because it downgraded, or because the cap was lowered — must not have its data deleted or hidden.
  Enforcement belongs at the **write that would exceed** the limit; existing rows are grandfathered and the UI
  says so. Decide this before S5-3, because the alternative is discovered in production by a school that just
  lost access to its own timetable.
- **Money is the one place where "eventually consistent" is a bug.** Activation on a browser redirect is the
  classic mistake: the user closes the tab, or replays the URL, and the two systems disagree. The webhook is
  the source of truth; the redirect only shows a spinner.
- **Webhook idempotency is not the same as event idempotency.** The queue's `(event_id, recipient_id)` key is
  ours. The provider's event id is theirs, arrives more than once by design, and can arrive **out of order** —
  a `canceled` followed by a late `active` must not resurrect a dead subscription. Store the provider's event
  id and its timestamp, and reject anything older than the state you already have.
- **Nothing in this product currently charges anyone, and that is a feature of the tests.** The provider port
  must have a fake with no network access, or CI acquires a dependency on a third party's sandbox — which will
  be down on the morning of a release.
- **Billing belongs to the school account, not the principal.** The matrix gives `Manage
subscription/billing` a single `✅`, in the School column. A principal runs the school day and does
  not hold the contract — and school accounts are web-only, so the whole surface is desktop.
- **Individuals are free, and must stay free.** The PRD is explicit. Every entitlement check must be scoped to
  a school; an accidental global gate would break the social layer for everyone with no school at all.
- **Secrets.** Provider API keys and webhook signing secrets join the config schema. `infrastructure/` holds no
  secrets, and the same must be true of every fixture and example file this sprint touches.

## Ceremonies

Planning · daily async standup · backlog refinement · review · retro.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI green ·
reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Push notifications and the mobile app — mobile phase. Advertising on the consumer surface — later. Gradebook and
report cards — later. **Moderation review** — the report queue has no reader (`PRD/06-social.md`); that is a
product decision carried from Sprint 4, not a billing item, but it is the oldest unkept promise in the product.

## Review notes

_Filled at sprint review._

## Retro

_Filled at retro._
