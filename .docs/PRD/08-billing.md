# PRD — Billing & Entitlements

`Status: Draft` · `Last updated: 2026-08-03`

School-subscription SaaS. Individuals are free (advertising funds the consumer side in a later phase).

## Concepts

- **Plan** — a named tier (e.g. Free/Pilot, Standard, Premium) with limits and features.
- **Subscription** — a school's active plan with billing period and status (`trialing | active | past_due | canceled`).
- **Entitlement** — the resolved set of feature flags/limits a school currently has.

## Requirements

| ID          | Priority | Requirement                                                | Acceptance criteria                                                  |
| ----------- | :------: | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| FR-BILL-001 |    P0    | Schools start on a trial on registration.                  | Trial subscription created; entitlements reflect trial limits.       |
| FR-BILL-002 |    P1    | A school subscribes to a paid plan via a payment provider. | Provider (Stripe or Razorpay) checkout; on success → `active`.       |
| FR-BILL-003 |    P1    | Entitlements gate school features/limits server-side.      | e.g. max classes, max members, advanced analytics — enforced by API. |
| FR-BILL-004 |    P1    | Webhooks reconcile subscription state.                     | Provider webhooks update status; signature-verified; idempotent.     |
| FR-BILL-005 |    P1    | Dunning on failed payment.                                 | `past_due` grace period; notifications; downgrade on cancel.         |
| FR-BILL-006 |    P2    | Invoices & billing history for school admins.              | Downloadable invoices; history list.                                 |

## The plan catalogue

**The numbers below are provisional and belong to product, not engineering** (S5-0b). They are what
`apps/api/src/modules/billing/plan-catalogue.ts` currently applies, so that entitlement enforcement
could be built and tested against something real. `null` means unlimited.

| Code       | Classes | Members | Advanced analytics |
| ---------- | ------: | ------: | :----------------: |
| `trial`    |       5 |     200 |         ➖         |
| `standard` |      40 |    1500 |         ➖         |
| `premium`  |     _∞_ |     _∞_ |         ✅         |

The catalogue lives in code and is applied to the table idempotently at API boot. Changing a limit
is a reviewed one-line edit and a restart — the table follows the code, never the other way round,
so a limit cannot be quietly widened for one customer in production.

**`trial` is also the floor.** A cancelled subscription resolves to it rather than to nothing: the
school keeps every class and member it already has, and simply cannot add beyond the free level
until it subscribes again. Cancelling is not deleting.

**Trial length is 30 days**, applied at registration in the same statement that creates the school.

## Provider decision

Deferred to an ADR at implementation time (`ADR-00xx`). Candidates: **Stripe** (global), **Razorpay** (India-first,
matches the legacy market). Region of pilot schools drives the choice.

## Entitlement resolution

```mermaid
flowchart LR
  Plan --> Entitlements
  Subscription -->|status| Entitlements
  Entitlements --> API[API authorization checks]
```
