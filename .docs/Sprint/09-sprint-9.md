# Sprint 9 — Somewhere to run

`Status: Planned` · `Last updated: 2026-08-08` · Duration: 2 weeks

Goal: make it possible to give this to a school. This is a **proposal for planning** — adjust the
split before committing.

## Sprint goal

> The product runs somewhere that is not a laptop, from an image somebody can point at, and the
> claims the TRD makes about it have been measured rather than asserted.

## What makes this sprint different

**The ungated work has run out, and that is the finding.**

For three sprints the plan has been in two halves: the part waiting on a decision, and the part that
starts on Monday regardless. It worked three times. Sprint 7's review notes said plainly that there
was no reason to assume a fourth half would be there. It is not. Every functional requirement still
outstanding is blocked on a payment provider, blocked on a mail transport, or is the mobile phase:

| Outstanding                | Blocked on         |
| -------------------------- | ------------------ |
| FR-BILL-002, 004, 005, 006 | a payment provider |
| FR-AUTH-010, FR-NOTIF-007  | a mail transport   |
| FR-NOTIF-004               | the mobile client  |

Read one way, that says the product is finished. It is not, and the reason the completeness record
does not show it is that **the missing thing was never a requirement.**

## The gap nobody wrote down

The product has never run anywhere.

- There is **no container image** for the API, the web app or the worker.
- `infrastructure/CLAUDE.md` documents six directories. Five of them — `docker/`, `kubernetes/`,
  `helm/`, `terraform/`, `nginx/` — **do not exist**. What is there is the observability stack, and
  it is pointed at nothing that runs.
- `docker-compose.yml` starts Postgres, Redis and MinIO. The application processes run on the host
  under `pnpm dev`. There is no way to start the product itself from a clean machine.
- The release workflow's deploy steps are four commented lines: build and push images, migrate,
  deploy, smoke. Every green release to `main` ships to a **branch**.
- `.docs/Deployment/00-environments.md` describes `dev`, `staging` and `production` with deploy
  triggers. None of the three exists.

None of this is a PRD requirement, so a completeness record reading 64 of 73 built, every P0 done,
never had a line for it. That is the honest shape of "what is left": not features, but the fact that
nothing has ever been deployed, backed up, restored, or measured under load.

## The decision that was made, and what it changed

**S8-0a and S8-0b are now deferred, explicitly, until everything else is complete** (product,
2026-08-08). That is a decision, and it is a better outcome than a sixth silent carry — five sprints
of asking produced an answer about _sequencing_ rather than an answer about _providers_.

It does put weight on the phrase "everything else", and this sprint is the definition of it. The PRD
says everything else is done. The paragraph above says it is not.

## Prerequisites — decisions, not work

| #     | Decision                                                                                                        | Blocks                 | Why it is not engineering's                                                                                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9-0a | **Where production runs** — cloud, region, managed Postgres or self-hosted.                                     | S9-8, S9-9             | It follows the pilot schools, like the payment provider does, and it is the one input Terraform cannot be written without. A staging target can be chosen provisionally.                          |
| S9-0b | **Retention** — how long marks, registers and report cards are kept, and what a leaving pupil's record becomes. | S9-11                  | Asked three times now: `11-gradebook.md`, `12-attendance.md`, `13-report-cards.md`. It is the first question with a legal edge and the only one that gets more expensive with every term of data. |
| S9-0c | **May a family download or keep a card?** (`13-report-cards.md` open question 1)                                | whether a PDF is work  | It decides whether "a card is a screen for now" holds or whether `FR-GRADE-050+` starts.                                                                                                          |
| S8-0a | **Stripe or Razorpay** — deferred by product on 2026-08-08.                                                     | FR-BILL-002…006        | Scheduled after this sprint's contents, not unanswered. Carried here so it is not lost.                                                                                                           |
| S8-0b | **A mail transport** — deferred by product on 2026-08-08.                                                       | FR-AUTH-010, NOTIF-007 | Same.                                                                                                                                                                                             |

## Committed backlog (proposed)

**Ungated — starts regardless.** Every item here is unblocked today.

| #     | Item                                                                                | Owner       | Est. | DoD                                                                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------- | ----------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9-1  | ✅ **Done 2026-08-08** — multi-stage Dockerfiles for api, worker and web            | devops      | L    | Two images, not three, and a third target for migrations — see below. Non-root, no dev dependencies, both verified by the new `images` CI job, which also scans them                                                      |
| S9-2  | ✅ **Done 2026-08-08** — `infrastructure/docker/compose.yml` runs the whole product | devops      | M    | One command from a clean machine to a working sign-in, proved by a smoke test rather than by claim. Migrations are their own container that everything waits on                                                           |
| S9-3  | ✅ **Done 2026-08-08** — images built and pushed by CI on every release             | devops      | M    | `api`, `migrate` and `web` to `ghcr.io`, tagged with the release date and never `latest`; digests written onto the GitHub Release                                                                                         |
| S9-4  | A **staging environment** the release actually reaches                              | devops      | L    | Migrations run as their own gated step; the worker deployed as a second process, since that is the arrangement every test now uses                                                                                        |
| S9-5  | ◐ **Harness built 2026-08-08**, not yet a gate                                      | devops      | M    | `e2e/smoke.spec.ts` + `smoke.config.ts` run against a stack that is already up; sabotage-checked by stopping the API. It becomes S9-5 proper when a deploy runs it and fails on it (S9-4)                                 |
| S9-6  | ◐ **Inventoried and scanned 2026-08-08; a manager still needs a target**            | devops      | M    | `Security/06-secrets.md` names every secret, its blast radius and its source. `secret-scan` runs gitleaks over the whole history on every PR — 143 commits, no findings, sabotage-checked. A secrets manager is S9-0a     |
| S9-7  | ◐ **Restore proven 2026-08-08; retention is not**                                   | devops      | L    | `scripts/restore-drill.mjs` takes a real dump, restores it, and compares every table's row count. 400,027 rows verified in 5.3s, sabotage-checked. RPO needs continuous archiving, which needs a provider — S9-0a         |
| S9-8  | Terraform for the chosen target                                                     | devops      | L    | **Gated on S9-0a.** Database, Redis, bucket, networking, secrets                                                                                                                                                          |
| S9-9  | ✅ **Done 2026-08-08** — `infrastructure/CLAUDE.md` corrected                       | devops      | S    | It documented six directories and had one. Absent ones are now marked ⏳ and `docker/` describes what is actually in it                                                                                                   |
| S9-10 | ◐ **Measured on a laptop 2026-08-08; the staging number is still owed**             | backend     | L    | `scripts/load-test.mjs`. Reads ~1,060 rps at p97.5 = 110 ms, writes p97.5 = 78 ms, no failed requests. Comfortably inside NFR-002 and NFR-003 — on a machine with no network in it, which is the caveat, not the footnote |
| S9-11 | ✅ **Done 2026-08-08** — accessibility measured, and it holds                       | frontend    | M    | `e2e/accessibility.spec.ts` scans 22 populated screens plus a failed form against WCAG 2.1 A/AA. Zero violations; sabotage-checked. The mechanical third only — the rest needs a person, and the spec says so             |
| S9-12 | ✅ **Done 2026-08-08** — coverage measured, and NFR-009 is met                      | backend     | S    | Services 95.3% lines / **80.8% branches** / 96.9% functions. Thresholds in `vitest.config.ts` now fail the build on regression, and CI runs the API suite with coverage rather than twice                                 |
| S9-13 | ✅ **Done 2026-08-09** — `PRD/10-completeness.md` gains its NFR half                | tech-writer | M    | Sixteen requirements, each with evidence or an admission. Four ✅, seven ◐, three ⛔ — and it found three the product's own documents contradict                                                                          |

**Gated on S8-0a — billing** (unchanged since Sprint 7, now explicitly scheduled after this sprint):
S8-10 the provider port and its fake · S8-11 checkout · S8-12 webhook reconciliation · S8-13 dunning.

**Gated on S8-0b — mail:** S8-14 the transport behind a port · S8-15 the email verification gate,
**only after** S8-14.

## What S9-1 found

Three things, and the pattern is the sprint's own risk paragraph coming true on the first day:
everything the product needs that only a developer's machine has ever provided.

**The web app could not have been deployed twice.** `lib/api-client.ts` read the API's location from
`NEXT_PUBLIC_API_URL`, and a `NEXT_PUBLIC_*` value is inlined into the bundle at build time. Staging
and production would have needed different images of identical code. The module's own docstring says
it is server-side only — the browser calls this app's route handlers, never the API — so it never
needed a public variable at all. It now prefers a plain `API_URL`, read at runtime, and keeps the
public one as a fallback because the E2E suite and every local `.env` set it.

**A stale `tsconfig.tsbuildinfo` was being copied into the image.** tsc read it, believed the output
it described already existed, and emitted declarations and no JavaScript — so `packages/types/dist`
arrived holding three `.d.ts` files and no `index.js`, and every import of it failed to resolve. The
build was reading a fact about a machine it was not running on. It is the stale-build trap from
`test:e2e` one layer down, and `.dockerignore` now excludes it.

**Two images, not three.** The plan said one each for the API, the worker and the web app. The API
and the worker are now one image with two commands, and the reason is S7-17: `worker.ts` and
`index.ts` had drifted, the worker built its notifications module without the audience parameter, it
type-checked, and every class fan-out in the split deployment reached nobody. Two images built from
one source is one more chance for exactly that. One artefact, two commands, and what runs in
production is what was tested.

There is a **third target**, `migrate`, and it exists because the runtime image deliberately cannot
migrate — `pnpm deploy --prod` drops the Prisma CLI. A schema in an image with nothing able to apply
it is worse than no schema, because it reads as a capability. The migration runner is what S9-4's
gated step will run.

Proven by running them: the API image reached Postgres, Redis and MinIO on a container network,
`/readyz` reported all three up, the migration runner applied all migrations to a fresh database,
and a school registered through the containerised API. 160 MB and 93 MB.

## What S9-2 added, and what it did not

The compose file is a second one, not a replacement. The root `docker-compose.yml` starts the
backing services and leaves the app to `pnpm dev`, which is the right trade while editing — a
rebuilt image per keystroke is not a development loop. This one answers the question that file
cannot: _does the product start on a machine that has never seen it?_

**Migrations are a container that everything waits on**, rather than a step in an entrypoint. An API
that starts against an unmigrated schema fails in a way that reads as a product bug, and the
distinction is worth a service.

The smoke test arrived early, because "reaches a working sign-in" is not a claim worth making
without one. It is short on purpose — register, sign in through the form, take one authorized
write — and each of the three is there for a reason no server test covers: the trial subscription
written in the same statement as the school, the session cookie surviving the round trip, and the
token the browser holds being one the API accepts.

It is **not yet S9-5**, and the sprint doc now says so. A smoke test that runs after a deploy is a
monitor; S9-5 is when it fails one. Sabotage-checked meanwhile by stopping the API container, which
fails it in 300 ms.

## What S9-3 found

**The first real release would have failed at the push.** `github.repository` is
`MNikks01/ConnectEd`, and a container reference must be lowercase — Docker refuses the name rather
than normalising it. Interpolating the variable straight into a tag would have failed _after_ the
tag and the GitHub Release had been created, which is the same ordering problem as
`release/2026-08-08.2` and would have looked just as much like a broken release. Caught by trying
`docker tag` with the real repository name rather than assuming.

The registry is `ghcr.io`, and that is not a decision about where the product runs. S9-0a is still
open; a registry and a cluster do not have to be the same provider, and `GITHUB_TOKEN` already has
the scope, so nothing was blocked waiting for it.

`Deployment/01-release-process.md` has described the intended pipeline since Sprint 2. It now opens
with a table separating what is wired from what is intent, because a release process nobody can tell
the truth about is worse than a short one.

## What S9-7 found

**NFR-014 is half a requirement without a provider, and the half that is left is worth having.**
RTO ≤ 1h and RPO ≤ 15 min were written in Sprint 2 and neither had ever been exercised;
`Runbooks/db-restore.md` described a PITR procedure against a managed instance, a standby and a WAL
archive, none of which exist.

The restore half can be proven anyway, and now is: `scripts/restore-drill.mjs` takes a real
`pg_dump`, restores it into a scratch database, and compares the row count of **every table** in
both. 400,027 rows across 50 tables — 185 MB, a 21 MB dump — restored and verified in **5.3
seconds** on a developer machine.

Sabotage-checked by excluding one table from the dump, which the drill catches and fails on. That is
the failure mode worth having a drill for: not a restore that errors, but one that succeeds and is
quietly incomplete.

**The number is evidence, not the RTO.** Noticing, deciding, provisioning and repointing are all
outside it and all dominate on a bad morning. The runbook now says so rather than implying the
opposite.

**RPO today is unbounded**, because nothing takes a backup on a schedule — the drill takes one when
you run it. Fifteen minutes needs continuous archiving and continuous archiving needs a provider, so
that half waits on S9-0a and is recorded as waiting rather than as done.

The drill's client runs in a `postgres:16` container rather than from the host, which is the one
detail most likely to matter later: a client older than the server refuses the dump outright, and
that is a discovery nobody wants to make during an incident.

A CI job runs it against a seeded database on every pull request. That does not prove the backups
work — there is no database with real data yet — it proves the drill does. A restore script that has
silently rotted is worse than none.

## What S9-11 found

**Nothing, and that is the result** — the product has no WCAG 2.1 A/AA violations that axe can see,
across every screen a pupil, a teacher and a school actually use. Nine sprints of Definition of Done
claiming "Accessible" turn out to have been true, which is not what any of the other unchecked
claims in this sprint turned out to be.

Two things make that a finding rather than a green tick.

**The screens have data on them.** An empty page passes every rule there is: a table with no rows
has no header association to get wrong, and a form nobody has submitted has no error to leave
unannounced. The setup issues a report card, publishes marks and takes a register before anything is
scanned, and there is a separate case for a login that has just failed — which is when accessibility
stops being decorative.

**The scan was sabotage-checked**, and the first attempt at that is worth recording. An unlabelled
input and an image with no alt text were added to the login page, and the suite _passed_ — because
Playwright was invoked directly rather than through `test:e2e`, so `next start` served the previous
build. That is precisely the stale-build trap S9-2 added a build step for, walked into by the person
who added it, four hours later. Run properly, the scan reports both violations by rule, impact and
selector.

**What this does not cover.** axe finds roughly a third of WCAG issues: the mechanical third —
contrast, names, roles, labels, landmarks. It cannot tell you whether a heading describes its
section, whether an error says what to do, or whether the marking grid can be operated by somebody
who cannot see it. NFR-012 is **measured, not audited**, and the difference belongs in the record.

## What S9-12 found

NFR-009 asks for **≥ 80% on domain and services**. Nothing had ever measured it, and roughly 1,150
passing tests is a count rather than a figure — the two are not the same claim, and only one of them
tells you which lines a change can break unnoticed.

| Group                  | Files | Lines |  Branches | Functions |
| ---------------------- | ----: | ----: | --------: | --------: |
| **Services** (the NFR) |    23 | 95.3% | **80.8%** |     96.9% |
| `shared/authz`         |     2 | 98.2% |     90.7% |    100.0% |
| Routes                 |    23 | 98.3% |     91.7% |     96.8% |
| Repositories           |    23 | 94.1% |     71.7% |     94.8% |
| Everything             |   185 | 89.4% |     78.0% |     92.0% |

**NFR-009 is met, and on branches it is met by 0.8 points.** That is the number to watch: branch
coverage is what falls when a guard clause is added without a test for the case it guards, and it is
the metric a growing codebase loses first.

"Everything" is lower and that is not alarming — it includes generated Prisma output, bootstrap and
observability wiring, none of which is what the requirement is about. Reporting only the whole-tree
figure would have understated the part that matters and flattered nothing.

Thresholds are now in `vitest.config.ts` as **floors slightly under what was measured**, not
aspirations: a threshold above the current figure is a build that is already red, and one far below
catches nothing. Sabotage-checked by raising the services line floor to 99.9%, which fails the run
with the real figure in the message.

CI runs the API suite **with** coverage rather than running it twice — the same 1,150 tests, one
pass, and the thresholds gate it.

## What S9-10 measured, and where

NFR-002 (p95 read < 300 ms, p95 write < 600 ms) and NFR-003 (500 RPS baseline) have been in the TRD
since Sprint 2 with no number attached. There is one now.

| Scenario                                            |   RPS |  p50 |  p90 | p97.5 |   p99 | non-2xx |
| --------------------------------------------------- | ----: | ---: | ---: | ----: | ----: | ------: |
| read `/me/memberships` — every page does this first | 1,060 | 36ms | 70ms | 110ms | 138ms |       0 |
| read a class feed — the read that fans out          | 1,074 | 39ms | 67ms | 104ms | 126ms |       0 |
| write an academic item — transaction + outbox row   |   408 | 18ms | 37ms |  78ms | 101ms |       0 |

**Inside both targets, with room.** Reads sustain twice NFR-003's baseline; the tail is a third of
NFR-002's allowance.

**p97.5, not p95, and deliberately.** autocannon reports a fixed set of percentiles and p95 is not
among them. Interpolating between p90 and p97.5 would be inventing a number, so the gate uses p97.5
against the p95 target — strictly harder to pass, which is the right direction to be wrong in.

**Where it ran is half the number.** An Apple M2 laptop, macOS 26.5.2, with the API, Postgres, Redis
and the load generator all on the same machine. There is **no network in these figures** — no TLS,
no proxy, no hop between the app and its database — and those are exactly what a p95 is usually
spent on. The dataset is also small: a class feed with little in it is a cheap read, and the number
would move on a school with three years of history.

So this is recorded as **half done**. What it proves is that nothing in the request path is
accidentally quadratic and that the harness works. NFR-002 and NFR-003 are about a deployed system,
and that is S9-4 — which is S9-0a.

The 500 RPS baseline is a read figure. The write scenario runs at ten connections on purpose: a
write here is a transaction plus an outbox row, and hammering it measures the disk underneath rather
than anything about the product.

## What S9-6 found

**The repository has never held a real secret, and that is why the rules had never been tested.**
Every value in it is a development constant or a compose default. So S9-6 split into the half that
can be done without an environment and the half that cannot.

The half that can: an inventory in `Security/06-secrets.md` — every secret, what it protects, what a
leak costs, and where it comes from in each environment. `JWT_PRIVATE_KEY` is the one worth naming
here, because its blast radius is impersonation of anyone, silently, and it is _optional_ in the
config schema. That is correct locally, where HS256 is the default and needs no key management, and
it means **its absence in a deployed environment is a defect rather than a default** — which is now
written down where somebody deploying will read it.

And a scanner. `secret-scan` runs gitleaks over the **whole history** on every pull request, not the
diff: a secret that entered three months ago is live today, and a diff-only scan would call the
branch clean. 143 commits, no findings.

**One false positive, ruled out rather than silenced.** `.env.example` shows the shape of a signing
key, whose body is three literal dots. The allowlist matches that placeholder and **not the file** —
exempting `.env.example` wholesale would make a real key pasted into the very file people copy the
one thing the scanner cannot see. Sabotage-checked by writing a genuine Ed25519 key into that file,
which is caught.

The half that cannot be done: a secrets manager, least-privilege access, an audit trail, and
rotation for anything but the signing key. All of it needs a target, which is S9-0a. The doc says
which parts are missing rather than describing them as though they exist — the mistake
`Runbooks/db-restore.md` had been making since Sprint 2.

## What S9-13 found

Writing the sixteen NFRs down with their evidence produced three findings that the functional half
of the completeness record could never have surfaced, because they are places where the product
**contradicts its own documents**:

- **NFR-006 — export and erasure do not exist.** No route, no service, nothing. `Security/04-compliance.md`
  lists both as subject rights the product provides.
- **NFR-016 — no internationalisation at all**, while `Class.medium` already offers Hindi as a
  teaching medium. The product models the language and cannot speak it.
- **NFR-011 — Playwright runs Chromium only, at one viewport.** Two evergreen browsers and 320px
  have been in the TRD since Sprint 2 and in every Definition of Done since Sprint 1.

**Blocked and unstarted turned out to be different words.** NFR-001 genuinely cannot be measured
until something is deployed. NFR-011 and NFR-016 are not blocked by anything — a second Playwright
project is an afternoon, externalising copy is a sprint, and neither is waiting on a decision. They
were simply never done, and nothing in this repository had ever said so.

**Four of the seven ◐ rows share one cause.** NFR-002, NFR-003, NFR-008 and NFR-014 are half-met in
exactly the same shape: the mechanism is built and exercised, and the deployed half has nowhere to
be tested. That is one decision — S9-0a — rather than four problems, and seeing them in a column
together is what made that obvious.

## Stretch (only if committed done)

| #     | Item                                                                                                 | Carried from |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------ |
| S9-14 | Retention implemented, once S9-0b is answered                                                        | new          |
| S9-15 | Product-event analytics sink (`Product/02-metrics.md`)                                               | S8-17        |
| S9-16 | Push-token registration (FR-NOTIF-004)                                                               | S8-18        |
| S9-17 | **Firefox and WebKit projects, and a 320px viewport** (NFR-011) — an afternoon, and nine sprints old | S9-13        |
| S9-18 | **Externalise copy, English + Hindi** (NFR-016) — the product already models the medium              | S9-13        |
| S9-19 | **Export and erasure** (NFR-006) — `Security/04-compliance.md` promises both and neither exists      | S9-13        |

## Dependencies / risks

- **A deploy is the first time this runs unattended, and that is where configuration lies.** The
  S7-17 lesson is the precedent: `RUN_WORKER_IN_PROCESS` defaulted to `true` in every test, so the
  split deployment had never started, and the first run of it found a shipped defect where class
  fan-out reached nobody. Expect more of exactly that shape. Everything the product needs that only
  a developer's machine has ever provided is now in scope for finding.

- **The relay is a process that must be running**, and staging is where that stops being a sentence
  in a document. `outbox_events_unpublished` is the gauge; an alert on it is part of S9-4, not a
  follow-up, because a stopped relay produces an empty queue and an empty queue looks like a quiet
  afternoon.

- **Load testing a system with no users invents its own traffic shape.** The numbers from S9-10 are
  worth having and are not a prediction. Say what shape was assumed, in the doc, next to the result.
  A register read every morning by every parent is the shape most likely to matter, and it is the
  one thing the product knows about its own future load.

- **This sprint spends money.** Everything before it ran on a laptop, in CI, and in free tiers. A
  staging environment, a container registry and a managed database are the first recurring cost, and
  the size of it depends on S9-0a. Worth knowing before the sprint rather than after.

- **Nothing here has been reviewed by a second person, still.** Nine sprints. Branch protection
  requires five checks and zero approvals, deliberately, because one collaborator cannot approve
  their own pull request. It is the only guard the repository does not have, and infrastructure work
  is where a second pair of eyes is worth most: a wrong security group is not caught by a type
  checker.

- **Two retros are outstanding.** Sprint 7's and Sprint 8's are both empty, waiting on action A4 —
  written in the room rather than reconstructed from commits. A third empty one would mean the
  action has failed rather than slipped, and it should be dropped honestly instead of carried.

## Ceremonies

Planning · daily async standup · backlog refinement · review · **retro, written in the room** —
including the two owed.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI
green · reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible · **and a route a person can reach it by**.

**New this sprint, for the NFR items:** _an NFR is done when there is a number from a run, not a
sentence in a table._ The functional half of the completeness record earns its "verified, not
remembered" heading by having been re-derived from the code. The non-functional half has never been
checked at all, and the same standard applies or the claim should be withdrawn.

## Out of scope

The mobile client. Advertising. Anything needing a payment provider or a mail transport — deferred
by product, and this sprint is the work that deferral was measured against.

## Still open for the team

**An approving review, the day a second person exists.** Unchanged, and more pointed than usual
given what this sprint touches.

## Review notes

_Filled at review._

## Retro

_Written at the retro, in the room — see action A4._
