# PRD — Completeness

`Status: Accepted` · `Last updated: 2026-08-05`

Every functional requirement in this folder, and whether it is built. Written at the point where
nothing was left that could be built without a decision from outside engineering, so that "what is
missing" is a list somebody can act on rather than a feeling.

**Legend:** ✅ built · ◐ half · ⛔ blocked on a decision · 🗓 deliberately later

## Accounts & authentication (`01-auth.md`)

| ID          | P   |     | Note                                                                         |
| ----------- | --- | --- | ---------------------------------------------------------------------------- |
| FR-AUTH-001 | P0  | ✅  |                                                                              |
| FR-AUTH-002 | P0  | ✅  |                                                                              |
| FR-AUTH-003 | P0  | ✅  | argon2id                                                                     |
| FR-AUTH-004 | P0  | ✅  |                                                                              |
| FR-AUTH-005 | P0  | ✅  | Rotation with reuse detection; a reused token kills the family               |
| FR-AUTH-006 | P0  | ✅  |                                                                              |
| FR-AUTH-007 | P0  | ✅  | School accounts refused on mobile clients                                    |
| FR-AUTH-008 | P1  | ✅  |                                                                              |
| FR-AUTH-009 | P1  | ✅  | Token, expiry, single use, session revocation — **no mail transport**        |
| FR-AUTH-010 | P1  | ⛔  | Needs a mail transport first; see below                                      |
| FR-AUTH-011 | P2  | ✅  | Per-IP limiter plus per-address exponential backoff                          |
| FR-AUTH-012 | P2  | ✅  | TOTP, encrypted at rest, recovery codes, enrolment confirmed by a first code |

## Institution (`02-institution.md`)

All of FR-INST-001 … 006 are ✅. **FR-INST-007** (P2, multiple principals) is written in the PRD as
a question — "default: one" — so it is a product decision rather than outstanding work.

## Verification (`03-verification.md`)

FR-VER-001 … 008 ✅. **FR-VER-009** (P2, bulk decisions) ✅ — up to 100 at once, partial success
reported per request.

## Academics (`04-academics.md`)

FR-ACAD-001 … 006, 010 … 012, 020, 030, 031 ✅. **FR-ACAD-021** (P2, structured timetable) is 🗓:
the PRD itself says "v1 accepts image upload; structured later", so building it now would be
overtaking the plan rather than completing it.

## Workflows (`05-workflows.md`)

FR-WF-001 … 006 and 010 … 012 ✅.

## Social (`06-social.md`)

FR-SOC-001 … 004, 010 … 012, 020 … 022 ✅. Moderation ✅ as of S6-6 — reports are read by ConnectEd
staff holding `PLATFORM_ADMIN` (ADR-0017), which closed the product's oldest unkept promise.

## Notifications (`07-notifications.md`)

| ID           | P   |     | Note                                                         |
| ------------ | --- | --- | ------------------------------------------------------------ |
| FR-NOTIF-001 | P0  | ✅  |                                                              |
| FR-NOTIF-002 | P0  | ✅  | Recipients computed server-side from verified membership     |
| FR-NOTIF-003 | P0  | ✅  |                                                              |
| FR-NOTIF-004 | P1  | 🗓   | Push tokens are the mobile phase                             |
| FR-NOTIF-005 | P1  | ✅  | BullMQ with backoff; the failed set is the dead-letter queue |
| FR-NOTIF-006 | P1  | ✅  | Six switchable categories; verification and billing are not  |
| FR-NOTIF-007 | P2  | ⛔  | A daily digest is an email                                   |

## Billing (`08-billing.md`)

| ID          | P   |     | Note                                                     |
| ----------- | --- | --- | -------------------------------------------------------- |
| FR-BILL-001 | P0  | ✅  | Trial created in the same statement as the school        |
| FR-BILL-002 | P1  | ⛔  | Checkout — needs the provider                            |
| FR-BILL-003 | P1  | ✅  | Limits at the write; `advancedAnalytics` gates analytics |
| FR-BILL-004 | P1  | ⛔  | Webhooks — needs the provider                            |
| FR-BILL-005 | P1  | ⛔  | Dunning — needs the provider                             |
| FR-BILL-006 | P2  | ⛔  | Invoices come from the provider                          |

## The four decisions everything blocked is waiting on

1. **A payment provider** — Stripe or Razorpay. Blocks FR-BILL-002, 004, 006 and the trigger half
   of 005. It follows the region of the pilot schools; the legacy product was India-first.

   **Corrected 2026-08-05:** an earlier draft of this line claimed the port and its fake already
   existed and only an adapter was missing. They do not. `apps/api/src/modules/billing` has one
   endpoint (`GET /schools/:id/subscription`) and no payment abstraction of any kind. What exists
   is everything _around_ a provider — the plan catalogue, the subscription record and its states
   including `PAST_DUE`, trial creation in the same statement as the school, and limit and feature
   enforcement at the write. What does not exist is checkout, webhook handling, invoices, or the
   port they would plug into. That is a module to build, not an adapter to write.

2. **A mail transport** — SES, Postmark, SMTP, something. Blocks FR-AUTH-010 and FR-NOTIF-007, and
   leaves FR-AUTH-009 built-but-undeliverable.

   **FR-AUTH-010 must not ship before the transport.** Its acceptance criterion is that unverified
   accounts have limited capability; gating anything on an email nobody can send would lock every
   new user out on the day it deployed. The flow without the gate does not meet the requirement,
   and the gate without the transport breaks the product. That ordering is a constraint, not a
   preference.

3. **What the plans actually limit** — the catalogue ships provisional numbers (trial 5/200,
   standard 40/1500, premium unlimited) and schools are enforced against them today.
4. **Branch protection** — neither branch requires a review or a passing check.

## Verified, not remembered

Re-checked on 2026-08-05 against `development`, by extracting every `FR-` id in this folder and
searching the whole of `apps/api`, `apps/web` and `packages` for each one, then reading the code
behind every id that did not appear.

- **73 functional requirements. 64 built, 1 half, 8 not.**
- Six were built but carry no `FR-` reference anywhere in the code — argon2id (003), refresh
  rotation and reuse detection (005), logout (006), academic image attachments (ACAD-006), the
  in-app notification list (NOTIF-003), and verification notifications (VER-007). Confirmed by
  reading the implementations. An id in a comment is a convention, not evidence.
- **Every P0 is built.** Everything outstanding is P1 or P2.

The whole tree at that commit: lint, type-check and build green across 14 tasks; 993 API tests and
87 end-to-end tests passing; `pnpm audit` clean with and without dev dependencies.

## What "built" is measured by

Nothing here rests on somebody's recollection. Every scoped endpoint has positive **and** negative
permission tests; the permission-matrix suite asserts all seven roles against the live API for every
capability in `09-permissions-matrix.md`, and its unimplemented list is empty. Roughly a thousand
API tests and eighty end-to-end ones, and the habit throughout has been to break each guarantee
deliberately and check that something fails.
