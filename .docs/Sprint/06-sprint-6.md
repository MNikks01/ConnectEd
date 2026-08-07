# Sprint 6 — Finishing commercialisation, and the console

`Status: Done (partial — see review)` · `Last updated: 2026-08-06` · Duration: 2 weeks

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

**S6-14 and S6-15, unplanned — the last two requirements the PRD had left as questions.**
FR-INST-007 asked "multiple principals? (default: one)" and is now decided as multi (ADR-0018). The
code already permitted it and always had: every principal check asks whether _this_ caller holds
that membership, never how many others do. What was missing was the decision and the proof, not the
capability. FR-ACAD-021 landed the structured timetable as a **second representation** rather than a
replacement — a school that photographs the sheet on the wall is not doing it wrong, and both kinds
share one version history, so last term's stays readable either way. What the structure adds is the
one thing an image cannot: the server refuses overlapping periods and subjects belonging to another
class.

**0.4.0 shipped as `release/2026-08-06`.** Ten commits, and security is the theme — a
whole-repository review at 0.3.0 and the four findings it closed (recovery-code modulo bias, the
missing web security headers, `X-Forwarded-For` believed on sight, and the Next bump that cleared
the last five advisories), plus the two requirements above and the two flake fixes. The tag and its
GitHub Release were cut by the workflow rather than by hand, which is what S6-9 and #68 were for.

**S6-16, unplanned — the back-merge hit a check that no changeset could satisfy.**
`changeset-check` was already skipped on a release PR, because `changeset version` consumes every
changeset on the release branch and the check could then only ever fail. The back-merge is the same
case pointing the other way and the `base_ref` test missed it: it carries the release commit — a
version bump and a CHANGELOG entry with the changesets already deleted — into `development`, so
`status` finds a changed package and nothing to explain it. Adding a changeset would have published
the version that had just shipped a second time.

It had never fired before because the 0.3.0 back-merge passed **vacuously**: its merge base _was_
`development`'s tip, which already carried the bump, so no package file appeared in the compared
range at all. A check can be green for two years and still have never run against the case it will
one day block.

Keyed the skip on the branch name, now a rule in `CI-CD/00-git-flow.md` rather than a habit, since
CI depends on it. The tempting rule — skip whenever the head already contains `main` — is wrong:
every feature branch cut after a back-merge contains `main` too, so the check would have quietly
stopped running on exactly the PRs it exists for. A check that silently stops running is worse than
one that fails loudly.

**Worth carrying into the retro.** Several of this sprint's unplanned items were tooling that had
never been exercised on the path it was written for — a release check that had never met a
back-merge, and a tag annotation that had never met a release branch carrying a later fix. Neither
was a product fault, and both surfaced at the moment they were most expensive to think about. A
smaller one in the same family: the timetable PR arrived with four unformatted files and a red
`verify`, because `lint-staged` formats what is staged and a commit that does not run it is not
formatted by anything else.

## Retro

**Drafted from the record, not from the room.** Every retro section in this repository has been an
empty placeholder for six sprints, so this is a first pass assembled from what the commits, PRs and
review notes actually show — the facts are checked, the team's account of them is not here yet.
Amend it at the ceremony; the actions in particular need owners who have agreed to them.

### Went well

**Planning around a missing decision worked, and it is now the second time.** The sprint was split
deliberately into what needed S6-0a and what did not. S6-0a never arrived, so the second half _was_
the sprint — the console, analytics, the security work and both remaining requirements shipped
without it. A plan that assumes the decision arrives would have produced a sprint of waiting.

**The console closed the product's oldest unkept promise.** S6-0c was decided as a platform-admin
role (ADR-0017), and S6-5 and S6-6 shipped on it: reports children file are now read by somebody,
which the product had promised since Sprint 4 and nothing had delivered.

**A security review that produced fixes rather than a document.** The whole-repository pass at 0.3.0
was followed in the same sprint by the four findings it raised — recovery-code bias, the missing web
security headers, `X-Forwarded-For` trusted on sight, and the advisories the Next bump cleared.

**Measured rather than assumed, repeatedly.** Both flakes were settled by experiment, not argument:
ten runs on each Next version (four failures against two) killed the theory that 16.3 broke the
test, and running the suites concurrently in a loop reproduced the reset failure on demand. One of
the two turned out not to be a flake at all.

**The PRD has no undecided requirements left.** FR-INST-007 and FR-ACAD-021 were the last two written
as questions. What remains is four external blockers — a payment provider and a mail transport —
and things the PRD itself scheduled later.

### Didn't go well

**S6-0a is carried for a third sprint.** It was S5-0a before it was S6-0a. Checkout, webhooks and
dunning _are_ the provider integration; the port-and-fake trick that saved Sprint 5 has nothing left
to abstract. This is the single largest piece of the roadmap not moving, and it is not an
engineering problem.

**Branch protection, sixth sprint running.** Neither branch requires a review or a passing check. In
this sprint alone a production release and six PRs were merged with one pair of eyes on them.

**Three separate pieces of tooling had never been exercised on the path they were written for.**
`changeset-check` had never met a back-merge; the release-tag annotation had never met a release
branch carrying a later fix; `lint-staged` formats what is staged and nothing formats what skipped
it. Each surfaced at the moment it was most expensive to think about — mid-release. A check can sit
green for a long time and still have never run against the case it will one day block.

**A merge went through without `verify` green.** Cancelling a stuck CI run while an auto-merge gate
was armed made the cancelled jobs drop out of the check list; the gate saw the two remaining checks
passing and merged. The content was a markdown file and post-merge CI on `development` was green, so
nothing broke — but the guarantee was not the one that had been described. Cancel the gate before
cancelling the run.

**Review and retro sections have been empty since Sprint 0.** This is the first one written, and it
is being written after the fact rather than at a ceremony.

### Actions — owners proposed, not agreed

| #   | Action                                                                                                                                    | Proposed owner   | By                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- |
| A1  | **Decide S6-0a** (Stripe or Razorpay) or explicitly drop billing from Sprint 7's goal. A third carry should be a decision, not a default. | product          | Sprint 7 planning |
| A2  | ✅ **Done 2026-08-06** — checks required on both branches; the review half deliberately not, see below.                                   | devops           | —                 |
| A3  | Audit the remaining release-path tooling for cases it has never run against — the ones found this sprint were all found by accident.      | devops           | Sprint 7          |
| A4  | Write the retro at the ceremony rather than reconstructing it, starting with Sprint 7.                                                    | whole team       | Sprint 7 retro    |
| A5  | Close out the `docs/close-sprint-2` branch — it still holds an unmerged Sprint 2 close-out commit from 2026-08-01.                        | technical-writer | Sprint 7          |

**A2, and the half of it that was not done.** Both branches now require a pull request, five passing
checks (`verify`, `e2e`, `observability-config`, `changeset-check`, `analyze`), and refuse force
pushes and deletions. Administrators keep a bypass.

**No approving review is required, and that is deliberate.** GitHub does not let anyone approve
their own pull request, and this repository has one collaborator — so requiring an approval would
have meant every merge, including a production release, going through the admin override. A rule
that is bypassed every time teaches people that the overrides are routine, which is worse than not
having the rule. The requirement is set to **zero approvals rather than removed**, which keeps the
pull request itself mandatory: deleting the review rule outright would have re-legalised pushing
straight to `main`, which is rule 1 of the git-flow doc and the oldest rule here.

Add the approval back the day a second person can give it. Until then this action is complete in the
part that was load-bearing — nothing red can merge, and nothing merges without a PR.

Verified rather than assumed: a probe PR into each branch reported `MERGEABLE` with
`mergeStateStatus: BLOCKED`, and `changeset-check` reported `skipping` on the `main` probe — which
matters, because a required check that never reports would otherwise deadlock every release PR.
