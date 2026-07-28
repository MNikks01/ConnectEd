# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

**ConnectEd** — a K-12 school-community platform (web brand *GetConnected*) being **rebuilt** on a modern stack.
The repo is currently in the **documentation + project-setup** phase: engineering docs are complete under
[`.docs/`](.docs/); application code is scaffolded but not yet implemented.

Two document sets — do not confuse them:

- [`.docs/`](.docs/) — **forward-looking engineering docs** for the rebuild. **Source of truth.**
- [`docs/`](docs/) — **legacy reverse-engineered PRD** of the original Firebase app. **Domain reference only.**
  Where the two disagree, `.docs/` wins; the rebuild deliberately reverses several legacy choices (see
  [`.docs/ADR/`](.docs/ADR/)).

## Stack (decided — see ADRs)

- **Monorepo:** pnpm workspaces + Turborepo — `apps/web`, `apps/api`, `packages/{types,ui,config}`.
- **Frontend:** Next.js (App Router) + React + TanStack Query.
- **Backend:** Node.js + Express + Prisma (modular monolith).
- **Database:** PostgreSQL. **Cache/queue:** Redis (BullMQ). **Media:** S3-compatible (MinIO locally).
- **Auth:** JWT access + rotating refresh, argon2id hashing. **AuthZ:** server-enforced RBAC + verification.
- **CI/CD:** GitHub Actions + Changesets + CodeRabbit + Husky. **Observability:** Prometheus/Grafana/Loki/Tempo.

## The one rule that defines the product

**All authorization is server-enforced** on every request against role + verification state + resource ownership.
The legacy app had *no* server-side access control and stored *plaintext passwords* — fixing this is the whole
point of the rebuild. The [permission matrix](.docs/PRD/09-permissions-matrix.md) is the contract; every scoped
endpoint needs positive **and** negative permission tests. Never gate access only on the client.

Other invariants: school (institution) accounts are **web-only**; passwords are **never** stored/logged in
plaintext; verification gates all academic reads/writes; academic writes are transactional with async
notification fan-out.

## Where things live

| Path | What |
|---|---|
| [`.docs/`](.docs/) | All engineering docs (start at [`.docs/README.md`](.docs/README.md)). |
| [`.agents/`](.agents/) | Team role charters (also usable as subagent personas). |
| `apps/web`, `apps/api` | Next.js app / Express API (see each folder's `CLAUDE.md`). |
| `packages/*` | Shared `types`, `ui` design system, `config` (eslint/tsconfig/prettier). |
| `infrastructure/` | docker, k8s, helm, terraform, nginx, and the observability stack configs. |
| `scripts/` | Tooling scripts (e.g. optional `setup-claude.sh`). |

## Working here

- **Git flow:** branch off `development` → PR into `development` → release PR to `main` (production). Never commit
  directly to `main`/`development`. Conventional Commits; include a Changeset for shippable changes. Full rules:
  [`.docs/CI-CD/00-git-flow.md`](.docs/CI-CD/00-git-flow.md).
- **Before a PR:** satisfy the relevant [`.docs/Checklists/`](.docs/Checklists/) and update docs/ADRs.
- **Significant/hard-to-reverse decision?** Write an ADR ([`.docs/ADR/`](.docs/ADR/)).
- **Commands** (live after project setup): see [`.docs/Setup/00-getting-started.md`](.docs/Setup/00-getting-started.md).
- Local settings `.claude/settings.local.json` are gitignored.

## Conventions

- TypeScript strict everywhere; no `any` at boundaries without justification; zod validates all external input.
- API modules follow routes → controllers → services → repositories; **Prisma only in repositories**; modules
  cross only via each other's public service interface + domain events ([`.docs/Architecture/01-modules.md`](.docs/Architecture/01-modules.md)).
- Docs use status banners, `FR-`/`NFR-`/`ADR-` IDs, and Mermaid (no external images).
