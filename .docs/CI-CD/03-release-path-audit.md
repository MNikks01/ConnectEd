# CI/CD — What the release path has never run against

`Status: Accepted` · `Last updated: 2026-08-06`

Sprint 7 action **A3**, from the Sprint 6 retro. Three pieces of tooling failed that sprint at the
moment they were most expensive to think about, and all three had the same shape: green for months,
never once exercised on the path they were written for. `changeset-check` had never met a
back-merge. The tag annotation had never met a release branch carrying a later fix. `lint-staged`
had never met a commit that skipped it.

So this is the same question asked deliberately, of everything on the release path: **what case has
this never run against, and is that a test or an accepted risk?**

Audited on 2026-08-06 against `development`, by reading each workflow and checking its run history
rather than reasoning about the YAML.

## Findings

| #   | Check                            | Never run against                                     | Outcome       |
| --- | -------------------------------- | ----------------------------------------------------- | ------------- |
| 1   | `Tag the release`                | A release where the step before it failed             | **Fixed**     |
| 2   | `changesets/action` (publish)    | Anything — nothing here is publishable                | Accepted risk |
| 3   | `changesets/action` (version PR) | Its own success — it has failed the one time it fired | Accepted risk |
| 4   | Required status checks           | A renamed job                                         | Accepted risk |
| 5   | `e2e` / `verify`                 | `RUN_WORKER_IN_PROCESS=false` — the split deployment  | **Gap**       |
| 6   | Tag `.2` suffix loop             | — exercised on 2026-08-04                             | Covered       |
| 7   | `contains(…, 'release/')`        | A hotfix, and a hand-edited merge title               | Accepted risk |
| 8   | Husky `pre-commit`               | A commit made with `--no-verify`                      | Accepted risk |

### 1. Tagging sat downstream of a step that has already failed — fixed

`Tag the release` ran after `Create Release PR or publish`. That step **has failed**, on 2026-08-04
(run `30876257447`): `GitHub Actions is not permitted to create or approve pull requests`. The job
stopped there, and every later step was skipped.

Nothing was lost, because the tag step did not exist yet — that release was hand-tagged for the
reason the git-flow doc gives. But the step exists now, and the failure mode is live: a release
merges to `main`, ships, and is never tagged, because a step that has nothing to do with tagging
failed first. The two have simply never coincided.

**Fixed** by moving the tag step ahead of the changesets step. `pnpm build` still gates it — a
release that does not build should not be tagged — but bookkeeping no longer can suppress it.

### 2. `changeset publish` has never published anything, and cannot

Every package in the repository is `private: true`, including `@connected/types`. `changeset
publish` therefore has nothing to do and has never done anything.

**Accepted risk.** The step is harmless and would become useful the day a package goes public. What
must not happen is someone reading its presence as evidence that publishing works. It is untested;
treat the first public package as new code, not as a configuration change.

### 3. The "Version Packages" PR path cannot work in this repository

The one time `changesets/action` had unconsumed changesets on `main` — a leftover naming an ignored
package, removed in #58 — it pushed `changeset-release/main` and then failed trying to open a PR,
because Actions is not permitted to create pull requests here.

The flow does not need it: `changeset version` runs on the release branch, deliberately, so `main`
never has changesets to consume. But a stray changeset on `main` re-arms it.

**Accepted risk**, with the cause written down. Fixing it is a repository setting ("Allow GitHub
Actions to create and approve pull requests"), and enabling that grants every workflow the ability
to open PRs — a larger permission than this needs. Finding #1 removes the consequence that mattered.

### 4. A renamed job silently blocks every pull request

Branch protection requires five checks **by name**: `verify`, `e2e`, `observability-config`,
`changeset-check`, `analyze (javascript-typescript)`. Rename a job — or change the CodeQL matrix
language, which is what generates that last name — and the required check never reports. GitHub
shows it as _expected_, indefinitely. Nothing errors; PRs simply stop being mergeable.

**Accepted risk**, recorded here because the symptom points nowhere near the cause. If it happens,
the fix is to update the required-checks list, not to debug CI.

### 5. The split-process deployment is never exercised — a real gap

`RUN_WORKER_IN_PROCESS` appears in no workflow and no test configuration, so it is always its
default, `true`. Every test therefore runs the API with the worker **in-process**.

Which means `apps/api/src/worker.ts` — the standalone worker — **has never been started by
anything**. Not by `verify`, not by `e2e`. It is the deployment the product is meant to use when
fan-out is heavy, and as of ADR-0019 it is also where the outbox relay lives in that mode. A typo in
that file would be found in production.

**Left open deliberately, and named as a gap rather than an accepted risk.** The cheap version is a
smoke test that boots `worker.ts` against Postgres and Redis and asserts it reaches its metrics
port; the honest version is an end-to-end run with `RUN_WORKER_IN_PROCESS=false` and the worker as a
second process. The second is what the deployment actually is. Neither is in this sprint.

### 6. The `.2` suffix loop — covered

Recorded so nobody audits it twice: `release/2026-08-04.2` and `release/2026-08-04.3` were both cut
by `github-actions[bot]` on the same day. The same-day collision path has run.

### 7. `contains(github.event.head_commit.message, 'release/')`

A hotfix straight to `main` is deliberately not tagged, and that is intended. The untested case is a
**merge whose title was edited by hand** — GitHub offers the merge message as editable text, and a
title without `release/` in it produces an untagged release, silently.

**Accepted risk.** The default message contains the branch name and the branch is required to be
`release/*`.

### 8. Husky `pre-commit` formats only what it is given

`pre-commit` is `lint-staged`; `pre-push` is `type-check`. A commit made with `--no-verify` is
formatted by nothing, and CI catches it at `format:check` — which is exactly what happened to the
timetable PR (#88) on 2026-08-06.

**Accepted risk**, and arguably correct: the bypass exists to be usable, and the check that catches
it is not skippable.

## What this audit did not cover

Deployment itself. The steps after tagging in `release.yml` are commented-out placeholders — no
images are built, no migrations are applied, nothing is deployed. There is no release path past
`main` to audit yet, and when there is, it should be audited with the same question.
