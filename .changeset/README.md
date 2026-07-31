# Changesets

Changesets track intent-to-release for the versioned packages in this monorepo. See
[`.docs/CI-CD/00-git-flow.md`](../.docs/CI-CD/00-git-flow.md).

## When to add one

Any PR that changes **shippable package** behaviour (`packages/*` that we publish/version). The apps
(`@connected/web`, `@connected/api`) are deployed, not published, so they're in `ignore` and don't need a
changeset — but PRs touching them still follow the git flow and CI gates.

## How

```bash
pnpm changeset          # pick packages + bump type (patch/minor/major) + summary
```

Commit the generated file in `.changeset/`. The `development → main` release PR consumes all pending changesets to
produce version bumps + `CHANGELOG.md` entries.
