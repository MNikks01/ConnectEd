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

| #     | Item                                                                                | Owner       | Est. | DoD                                                                                                                                                                                                               |
| ----- | ----------------------------------------------------------------------------------- | ----------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9-1  | ✅ **Done 2026-08-08** — multi-stage Dockerfiles for api, worker and web            | devops      | L    | Two images, not three, and a third target for migrations — see below. Non-root, no dev dependencies, both verified by the new `images` CI job, which also scans them                                              |
| S9-2  | ✅ **Done 2026-08-08** — `infrastructure/docker/compose.yml` runs the whole product | devops      | M    | One command from a clean machine to a working sign-in, proved by a smoke test rather than by claim. Migrations are their own container that everything waits on                                                   |
| S9-3  | ✅ **Done 2026-08-08** — images built and pushed by CI on every release             | devops      | M    | `api`, `migrate` and `web` to `ghcr.io`, tagged with the release date and never `latest`; digests written onto the GitHub Release                                                                                 |
| S9-4  | A **staging environment** the release actually reaches                              | devops      | L    | Migrations run as their own gated step; the worker deployed as a second process, since that is the arrangement every test now uses                                                                                |
| S9-5  | ◐ **Harness built 2026-08-08**, not yet a gate                                      | devops      | M    | `e2e/smoke.spec.ts` + `smoke.config.ts` run against a stack that is already up; sabotage-checked by stopping the API. It becomes S9-5 proper when a deploy runs it and fails on it (S9-4)                         |
| S9-6  | Secrets, for the first time                                                         | devops      | M    | Nothing has ever needed a real one: every secret in the repository is an E2E constant or a compose default. Rotation documented, not just storage                                                                 |
| S9-7  | ◐ **Restore proven 2026-08-08; retention is not**                                   | devops      | L    | `scripts/restore-drill.mjs` takes a real dump, restores it, and compares every table's row count. 400,027 rows verified in 5.3s, sabotage-checked. RPO needs continuous archiving, which needs a provider — S9-0a |
| S9-8  | Terraform for the chosen target                                                     | devops      | L    | **Gated on S9-0a.** Database, Redis, bucket, networking, secrets                                                                                                                                                  |
| S9-9  | `infrastructure/CLAUDE.md` corrected                                                | devops      | S    | It documents five directories that do not exist. Either they arrive in this sprint or the file stops claiming them                                                                                                |
| S9-10 | **NFR evidence**: latency and throughput measured (NFR-002, 003)                    | backend     | L    | p95 read < 300 ms, p95 write < 600 ms, 500 RPS baseline. A number from a run, against staging, with the shape of the load written down                                                                            |
| S9-11 | **NFR evidence**: accessibility audited (NFR-012)                                   | frontend    | M    | WCAG 2.1 AA across the real screens, not a Lighthouse score on the home page. Every item's DoD has claimed a11y for nine sprints and nothing has ever checked it                                                  |
| S9-12 | **NFR evidence**: coverage measured (NFR-009)                                       | backend     | S    | ≥ 80% on domain and services. ~1150 tests is a count, not a coverage figure, and the two are not the same claim                                                                                                   |
| S9-13 | `PRD/10-completeness.md` gains an **NFR half**                                      | tech-writer | M    | Sixteen NFRs, each ✅/◐/⛔ with its evidence — the same standard the functional half already meets. Written last, from what S9-10…12 actually found                                                               |

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

## Stretch (only if committed done)

| #     | Item                                                   | Carried from |
| ----- | ------------------------------------------------------ | ------------ |
| S9-14 | Retention implemented, once S9-0b is answered          | new          |
| S9-15 | Product-event analytics sink (`Product/02-metrics.md`) | S8-17        |
| S9-16 | Push-token registration (FR-NOTIF-004)                 | S8-18        |

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
