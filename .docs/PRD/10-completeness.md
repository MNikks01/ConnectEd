# PRD — Completeness

`Status: Accepted` · `Last updated: 2026-08-09`

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

All of FR-INST-001 … 007 are ✅. **FR-INST-007** was written in the PRD as a question — "multiple
principals? (default: one)" — and was decided as multi in ADR-0018. The code already permitted it:
nothing ever enforced one principal, because every principal check asks whether _this_ caller holds
that membership and never how many others do. What was missing was the proof, which is now
`multiple-principals.test.ts` — the flow a school actually uses, then all three halves of the
promise: a second principal can be verified, can do everything the first can, and can do nothing
more.

## Verification (`03-verification.md`)

FR-VER-001 … 008 ✅. **FR-VER-009** (P2, bulk decisions) ✅ — up to 100 at once, partial success
reported per request.

## Academics (`04-academics.md`)

FR-ACAD-001 … 006, 010 … 012, 020, 021, 030, 031 ✅. **FR-ACAD-021** (structured timetable) landed
as a _second representation_ rather than a replacement — FR-ACAD-020 asks for "image/structured",
and a school that photographs the sheet on the wall is not doing it wrong. Both kinds share one
version history, so a school can switch either way and last term's is still readable. What the
structured form adds is the only thing a photograph cannot: the server refuses overlapping periods
and subjects belonging to another class.

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

## The decisions everything blocked is waiting on

**Both 1 and 2 were deferred by product on 2026-08-08**, explicitly, until everything else is
complete. That is an answer about sequencing rather than about providers, and it is recorded here
because five sprints of asking produced no other kind. What it puts weight on is the phrase
"everything else" — see the deployment gap below, which is not a requirement and is the reason this
document reading "every P0 built" does not mean the product can be given to a school.

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
4. ~~**Branch protection**~~ — **resolved 2026-08-06.** Both branches now require a pull request and
   five passing checks, and refuse force pushes and deletions. No approving review is required, and
   that is deliberate: GitHub does not let anyone approve their own pull request and the repository
   has one collaborator, so requiring one would route every merge through the admin override. The
   requirement is set to zero approvals rather than removed, which keeps the pull request itself
   mandatory. Add the approval the day a second person can give it.

## Gaps that are not requirements

Nothing in the PRD asks for these, which is exactly why they are written down here — the first one
had already been forgotten once.

### ✅ A domain event whose publish fails is lost — **fixed 2026-08-06**

`shared/queue` used to catch a failed or timed-out `queue.add` and log at error level. That was
deliberate and half-right: the domain change had already committed, and failing the caller then
would have reported an error for something that succeeded. The price was the event. A homework post
was created, its fan-out never happened, and the only trace was a log line.

Closed by the **transactional outbox** (ADR-0019, S7-1 and S7-2). All eight domain events are now
written in the same transaction as the change that produced them, and a relay hands them to the
queue afterwards; a failed handoff leaves the row for the next pass. The publisher was deleted
rather than deprecated, so there is no longer a code path that can drop an event.

What it does **not** do, since an outbox invites the assumption: delivery is still at-least-once and
consumers are still idempotent on `eventId`, and BullMQ still owns retries, backoff and the
dead-letter set.

The number to watch is `outbox_events_unpublished`. A stopped relay produces an _empty_ queue, which
is indistinguishable from a quiet afternoon — the pile is only visible if something counts it.

### The product has never run anywhere — **open**

Recorded on 2026-08-08, while planning Sprint 9, because a completeness record that reads 64 of 73
built and every P0 done should not be able to hide this.

- There is **no container image** for the API, the web app or the worker.
- `infrastructure/CLAUDE.md` documents six directories; five of them — `docker/`, `kubernetes/`,
  `helm/`, `terraform/`, `nginx/` — do not exist. The observability stack that does exist is pointed
  at nothing that runs.
- `docker-compose.yml` starts Postgres, Redis and MinIO; the application processes run on the host
  under `pnpm dev`. There is no way to start the product from a clean machine.
- The release workflow's deploy steps are four commented lines. Every green release to `main` ships
  to a **branch**.
- `Deployment/00-environments.md` describes `dev`, `staging` and `production` with deploy triggers.
  None of the three exists.

Nothing in the PRD asks for any of it, which is why nine sprints of tracking functional requirements
never showed it. `Sprint/09-sprint-9.md` is the plan for it.

**Related and equally unmeasured: the sixteen NFRs in `TRD/00-technical-requirements.md` have no
evidence section.** Latency, throughput, coverage, accessibility, and the RTO/RPO in NFR-014 are
assertions in a table. The functional half of this document earns its "verified, not remembered"
heading; the non-functional half has never been checked at all.

### The relay is a process that must be running

The new failure mode, stated plainly because it did not exist before. Events are no longer lost, but
they are not delivered either while the relay is down; they accumulate. That is a far better failure
— it is recoverable and it is visible — but it is a failure, and the gauge above is what makes it
one somebody can see.

### Four gaps that were never real

Audited against `development` on 2026-08-06 and recorded so they are not re-reported: access tokens
are Ed25519 with a published JWKS (ADR-0014), cursor pagination is in fifteen repositories, all five
dashboards have metrics behind them, and the notification list and preferences UI both exist.

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

**Since, on 2026-08-06:** 1038 API tests. The requirement count is unchanged — FR-INST-007 and
FR-ACAD-021 moved from question to built, and the outbox added no requirement because the PRD never
asked for one. That is the point of the section above it.

## The non-functional half (NFR-001 … 016)

Added 2026-08-09 (S9-13). Until Sprint 9 this document tracked seventy-three functional
requirements meticulously and **sixteen non-functional ones not at all** — they sat in
[`../TRD/00-technical-requirements.md`](../TRD/00-technical-requirements.md) as a table of
sentences, none of which had ever been checked. The heading above this one says "verified, not
remembered", and it was only ever true of half the product.

Each row below carries its evidence or says it has none. **Where there is a number it came from a
run**, and where the run happened is part of the number.

| ID      | Requirement                                      | State | Evidence, or what is missing                                                                                                                                                      |
| ------- | ------------------------------------------------ | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-001 | Availability ≥ 99.9%                             |  ⛔   | Unmeasurable: nothing is deployed, so there is no uptime to observe. S9-0a                                                                                                        |
| NFR-002 | p95 read < 300 ms, write < 600 ms                |   ◐   | **110 ms and 78 ms at p97.5** — stricter than p95 (S9-10). On a laptop with no network in it; the deployed number is owed                                                         |
| NFR-003 | 500 RPS baseline                                 |   ◐   | **~1,060 RPS on reads**, same run, same caveat                                                                                                                                    |
| NFR-004 | Stateless, horizontally scalable                 |  ✅   | Sessions and cache are in Redis, never in process. The worker runs as a **separate process** in CI and in compose — the split ADR-0019 assumes (S7-17, S9-2)                      |
| NFR-005 | OWASP ASVS L2                                    |   ◐   | A security review exists ([`../Security/05-review-2026-08-05.md`](../Security/05-review-2026-08-05.md)) and found real defects. **ASVS L2 has never been walked as a checklist**  |
| NFR-006 | argon2id · PII at rest · delete/export           |  ✅   | argon2id ✅; TOTP secrets encrypted at rest ✅. **Export and erasure now exist** end to end (S9-19, [`14-export-and-erasure.md`](./14-export-and-erasure.md), ADR-0020)           |
| NFR-007 | Transactional writes, idempotent effects         |  ✅   | Academic writes are transactional; the outbox writes events in the same transaction and consumers are idempotent on `eventId` (ADR-0019)                                          |
| NFR-008 | Structured logs · RED metrics · tracing          |   ◐   | Logs with correlation IDs ✅, RED metrics ✅, OTLP export configured and a Tempo collector in local compose ✅. **No deployed collector**, so no trace has crossed a real network |
| NFR-009 | ≥ 80% coverage on domain/services                |  ✅   | **Services 95.3% lines, 80.8% branches, 96.9% functions** (S9-12). Thresholds now fail the build on regression                                                                    |
| NFR-010 | Docker Compose locally · images for deploy       |  ✅   | `docker compose -f infrastructure/docker/compose.yml up` reaches a working sign-in (S9-2); three images pushed per release (S9-1, S9-3)                                           |
| NFR-011 | Latest 2 evergreen browsers · ≥ 320px            |  ✅   | Chromium, Firefox and WebKit in CI, plus a 320px project (S9-17). Its first run found two defects: WebKit dropped every session cookie, and one page overflowed by 69px           |
| NFR-012 | WCAG 2.1 AA                                      |   ◐   | **Zero violations** across 22 populated screens and a failed form (S9-11) — the mechanical third that axe can see. Not a human audit                                              |
| NFR-013 | Strict TS · lint/format gates · ADRs             |  ✅   | Strict everywhere, gates in `verify`, 18 ADRs, seven `CLAUDE.md` files                                                                                                            |
| NFR-014 | Nightly backups · PITR · RTO ≤ 1h · RPO ≤ 15 min |   ◐   | **Restore proven: 400,027 rows verified in 5.3 s**, sabotage-checked (S9-7). Nothing takes a backup on a schedule, so **RPO is unbounded**; PITR needs a provider                 |
| NFR-015 | Rate limiting on auth and writes                 |  ✅   | Per-IP limiter plus per-address exponential backoff, with tests (FR-AUTH-011)                                                                                                     |
| NFR-016 | Copy externalised · English + Hindi              |  ⛔   | **Not started.** No i18n library, no message catalogue, every string inline — while the product models `medium` per class and offers Hindi as one                                 |

**Six ✅, six ◐, two ⛔** — NFR-006 moved from ◐ to ✅ with S9-19, and it is the only row here that
was a promise the product had made in writing rather than a target it had set itself.

The paragraph below is kept as it was written on 2026-08-09, because the record of what the table
found is worth more than a tidy table. Two of the three contradictions it names are now closed:
NFR-011 by S9-17 and NFR-006 by S9-19. **NFR-016 is the one that is left**, and it is still not
blocked by anything.

### What this half says that the functional half did not

**Three requirements are contradicted by the product's own promises.** NFR-006's export and erasure
are written into `Security/04-compliance.md` as subject rights; there is no code behind either.
NFR-016 asks for Hindi while `Class.medium` already offers it as a teaching medium — the product
models the language and cannot speak it. NFR-011 asks for two evergreen browsers and the suite has
only ever run one.

**The ⛔ rows are not all the same kind.** NFR-001 cannot be measured until something is deployed and
is honestly blocked. NFR-011 and NFR-016 are _not blocked by anything_ — a second Playwright project
and a viewport are an afternoon; externalising copy is a sprint but nothing stands in its way. They
are unstarted, which is a different word from blocked, and this table is the first place that
distinction has been written down.

**Seven ◐ rows, and four share one cause.** NFR-002, NFR-003, NFR-008 and NFR-014 are all half-met
in exactly the same way: the mechanism is built and exercised, and the _deployed_ half of the claim
has nowhere to be tested. That is one decision — S9-0a — not four problems.

## What "built" is measured by

Nothing here rests on somebody's recollection. **That was true of the functional half before it was
true of the non-functional one**, and the table above is what closed the gap: sixteen requirements
that had been asserted since Sprint 2 now each carry a number, a test, or an admission.

Every scoped endpoint has positive **and** negative
permission tests; the permission-matrix suite asserts all seven roles against the live API for every
capability in `09-permissions-matrix.md`, and its unimplemented list is empty. Roughly a thousand
API tests and eighty end-to-end ones, and the habit throughout has been to break each guarantee
deliberately and check that something fails.
