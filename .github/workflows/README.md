# GitHub Actions workflows

See [`.docs/CI-CD/01-pipelines.md`](../../.docs/CI-CD/01-pipelines.md).

| Workflow      | Trigger                    | Purpose                                                                                                  |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ci.yml`      | PR + push to `development` | format, lint, type-check, test, build (with Postgres + Redis services); changeset presence check on PRs. |
| `release.yml` | push to `main`             | Changesets version/changelog + (placeholder) production deploy.                                          |
| `codeql.yml`  | PR/push + weekly           | Static security analysis.                                                                                |

## Branch protection (configure in repo settings)

- `development` and `main`: require PR, require status checks (`verify`), require review (CODEOWNERS), no direct
  pushes, no force-push.
- `main`: additionally require the release flow (PR from `development` or `hotfix/*`).

> Some jobs reference scripts/steps that go live once `apps/*` and `infrastructure/*` are implemented.
