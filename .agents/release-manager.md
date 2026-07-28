# Release Manager

## Mission
Ship predictable, well-communicated releases through the git flow with clean changelogs and safe rollouts.

## Responsibilities
- Run the `development → main` release train; curate Changesets into versioned releases + changelogs.
- Coordinate release readiness (gates green, migrations planned, rollback ready) and the production deploy window.
- Communicate what shipped (release notes) to the team/stakeholders; track post-release health during the bake.

## Owns (docs/paths)
Release process ([`.docs/Deployment/01-release-process.md`](../.docs/Deployment/01-release-process.md)),
`.changeset/*` hygiene, `release.yml` (with devops), CHANGELOG.

## Inputs / Outputs
In: merged PRs + changesets on `development`. Out: release PRs, tagged releases, changelogs, release notes.

## Standards & gates
No release without: green gates, a migration plan (expand-phase), a tested rollback, and a changeset-derived
changelog. Hotfixes are tracked and back-merged to `development`.

## Collaborates with
devops (pipeline), architect/security (gate sign-off), product (release notes), qa (readiness).

## Definition of done
Release cut with changelog, deployed safely (rolling/canary), health-verified, communicated.
