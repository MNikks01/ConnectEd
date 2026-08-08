# Sprint 8 — Finish what the gradebook started

`Status: Planned` · `Last updated: 2026-08-07` · Duration: 2 weeks

Goal: make the gradebook usable by the people it was built for, and take the next academic
capability that needs nobody's permission. This is a **proposal for planning** — adjust the split
before committing.

## Sprint goal

> A teacher can run an assessment from setting it to correcting it without touching an API, and a
> school can mark a register.

## What makes this sprint different

**It opens by finishing something, not starting it.** Sprint 7 shipped the gradebook's PRD, data
model, server and reading screens, and a teacher still cannot create an assessment in the product —
only through the API. The end-to-end test created its assessment through the API too, which is
exactly why the hole stayed invisible: every automated check passed, and the feature is unreachable
for its primary user.

That is the first item, and it is worth naming rather than folding quietly into "polish". A test
that sets up through the back door proves the back door works.

## Prerequisites — decisions, not work

| #     | Decision                                                               | Blocks               | Why it is not engineering's                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S8-0a | **Stripe or Razorpay** (ADR-0015, carried ×4)                          | S8-10 … S8-13        | Fifth sprint of asking. Sprint 7's plan said a fourth silent carry was the outcome to avoid, and it happened anyway.                                                                    |
| S8-0b | **A mail transport** (carried)                                         | S8-14, S8-15         | FR-AUTH-009 is built and undeliverable until one exists.                                                                                                                                |
| S8-0c | ✅ **Decided 2026-08-08: raw score and percentage, no letters.**       | S8-6, S8-7 unblocked | A scale is the part that differs per board, and every way of holding it now is worse than not holding it yet. Letter bands stay possible later because the raw score is what is stored. |
| S8-0d | ✅ **Decided 2026-08-08: yes — a separate staff note** (FR-GRADE-015). | Done, shipped        | A field rather than a flag: the question a teacher answers while typing is _who is this for_. Labelled by who reads it, and the UI says private is not absolute.                        |

**Both were answered on 2026-08-08, before anybody typed something candid into a shared field.**
S8-0d shipped the same day it was decided, which was the whole argument for asking early.

## Committed backlog (proposed)

**Ungated — starts regardless:**

| #    | Item                                                                                | Owner    | Est. | DoD                                                                                                                                                                                    |
| ---- | ----------------------------------------------------------------------------------- | -------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S8-1 | ✅ **Done 2026-08-07** — creating an assessment, in the product                     | frontend | M    | The end-to-end test drives the form; removing the form fails it, and the API helper it used to lean on is deleted                                                                      |
| S8-2 | ✅ **Done 2026-08-07** — correcting a published mark, in the product (FR-GRADE-012) | frontend | M    | One pupil at a time, showing what it was; the audit row exists and is not shown to the pupil. Two pupils in the test, because one cannot tell "the right pupil" from "the first pupil" |
| S8-3 | ✅ **Done 2026-08-07** — the school's view of a class's marks                       | frontend | S    | Read-only, drafts included, and it fixed a server inconsistency: the school could open a draft by id and never see one listed                                                          |
| S8-4 | ✅ **Done 2026-08-07** — attendance, PRD and server                                 | backend  | L    | `PRD/12-attendance.md` first; accepted leave pre-fills EXCUSED; per-pupil visibility reuses the gradebook's rules and the pupil link                                                   |
| S8-5 | ✅ **Done 2026-08-07** — attendance on screen                                       | frontend | M    | A register taken in one pass with the school's own leave offered as Excused; a pupil and parent see their own days only                                                                |

**Gated on S8-0c — report cards:**

| #    | Item                                                               | Owner                 | Est. | DoD                                                                                                           |
| ---- | ------------------------------------------------------------------ | --------------------- | ---- | ------------------------------------------------------------------------------------------------------------- |
| S8-6 | ✅ **Done 2026-08-08** — `PRD/13-report-cards.md`, `Status: Draft` | product + tech-writer | M    | Terms, what a card contains, and the decision that a card is _issued_ as a snapshot rather than rendered live |
| S8-7 | Report cards, server and screen                                    | backend + frontend    | L    | Aggregates published marks only; a card is generated from data, never typed                                   |

**Gated on S8-0a — the billing module** (unchanged from Sprint 7, and unstarted):

| #     | Item                                      | Owner   | Est. |
| ----- | ----------------------------------------- | ------- | ---- |
| S8-10 | ADR-0015, the provider port, and its fake | backend | M    |
| S8-11 | Checkout and activation (FR-BILL-002)     | backend | M    |
| S8-12 | Webhook reconciliation (FR-BILL-004)      | backend | L    |
| S8-13 | Dunning (FR-BILL-005)                     | backend | M    |

**Gated on S8-0b — mail:**

| #     | Item                                  | Owner   | Est. | DoD                                                                            |
| ----- | ------------------------------------- | ------- | ---- | ------------------------------------------------------------------------------ |
| S8-14 | Mail transport behind a port          | backend | M    | A fake in tests; no live send from CI; bounces observable                      |
| S8-15 | Email verification gate (FR-AUTH-010) | backend | M    | **Ships only after S8-14.** Gating on an unsendable email locks out every user |

## Stretch (only if committed done)

| #     | Item                                                           | Owner   | Carried from |
| ----- | -------------------------------------------------------------- | ------- | ------------ |
| S8-16 | Invoices and billing history (FR-BILL-006, P2)                 | backend | S7-14        |
| S8-17 | Product-event analytics sink (`Product/02-metrics.md` funnels) | devops  | S7-15        |
| S8-18 | Push-token registration (FR-NOTIF-004)                         | backend | S7-16        |

## Dependencies / risks

- **The lesson from S8-1 generalises, and the audit habit should follow it.** S7-3 asked what each
  CI check had never run against. The same question applied to a _feature_ is: which screens does no
  test reach except through the API? Every fixture shortcut is a claim that the front door works,
  and none of them checks it.
- **Attendance is the gradebook's shape again, and that is the point.** A register is a per-pupil
  fact with the same audience: the pupil, their parents through the school-confirmed link, the
  teacher, the class teacher, the principal. If the gradebook's rules were right, attendance should
  be able to reuse them almost exactly — and if it cannot, the gradebook's were wrong.
- **Attendance is also the first thing a parent will check daily.** Homework is read when it is set;
  a register is read every morning by somebody deciding whether to worry. Its read path deserves
  more care about latency than anything shipped so far.
- **A report card is not a query.** It is a document a school signs, and generating one from
  unpublished or partial marks is how a school ends up defending a number it never approved. S8-7
  aggregating only published marks is a correctness requirement, not a filter.
- **Nothing here has been reviewed by a second person.** Branch protection requires checks and zero
  approvals, deliberately, because one collaborator cannot approve their own pull request. The
  gradebook's product decisions — no rank, drafts invisible, an unmarked pupil is not a zero — were
  taken and shipped without anyone disagreeing with them once.

## Ceremonies

Planning · daily async standup · backlog refinement · review · **retro, written in the room**
(action A4, still outstanding: Sprint 6's was reconstructed from commits, and Sprint 7's is
deliberately empty waiting for the ceremony).

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI
green · reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible · **and a route a person can reach it by**.

## Out of scope

The mobile client. Advertising. Anything that needs a payment provider, unless S8-0a arrives.

## Still open for the team

**An approving review, the day a second person exists.** It is the one half of retro action A2 that
was left undone on purpose, and it is now the only guard the repository does not have.

## Review notes

_Filled at review._

## Retro

_Written at the retro, in the room — see action A4._
