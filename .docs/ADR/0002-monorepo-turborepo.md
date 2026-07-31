# ADR-0002 — pnpm workspaces + Turborepo monorepo

Status: Accepted
Date: 2026-07-28

## Context

Web and API share domain types (DTOs, enums, the permission matrix). Keeping them in separate repos causes drift.
We want one CI, shared config, atomic cross-cutting changes, and changesets-based versioning.

## Decision

Single **monorepo** using **pnpm workspaces** for dependency management and **Turborepo** for task
orchestration/caching. Layout: `apps/web`, `apps/api`, `packages/types`, `packages/ui`, `packages/config`.

## Consequences

- **Positive:** shared types eliminate client/server drift; one PR can change API + web atomically; Turbo caches
  builds/tests; consistent tooling via `packages/config`.
- **Negative:** monorepo tooling learning curve; CI must scope tasks to changed packages to stay fast.
- **Follow-ups:** `turbo.json` pipeline, remote caching (optional), CODEOWNERS per package.

## Alternatives

- **npm/yarn workspaces without Turbo** — workable but weaker caching/orchestration.
- **Nx** — more powerful but heavier; Turborepo is lighter and sufficient.
- **Polyrepo** — rejected: type drift and cross-repo coordination overhead.
