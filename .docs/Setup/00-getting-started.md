# Getting Started

`Status: Accepted` · `Last updated: 2026-07-28`

> The application code does not exist yet — this repo is currently **docs + project setup**. Once the monorepo
> tooling lands (Task: project setup), these commands become live. Steps marked _(after setup)_ depend on it.

## Prerequisites

- **Node.js** ≥ 20 LTS
- **pnpm** ≥ 9 (`corepack enable` then `corepack prepare pnpm@latest --activate`)
- **Docker** + Docker Compose (Postgres, Redis, MinIO, observability)
- **Git** with access to `github.com/MNikks01/ConnectEd`

## First-time setup _(after setup)_

```bash
git clone https://github.com/MNikks01/ConnectEd.git
cd ConnectEd
pnpm install
cp .env.example .env            # fill in local values
docker compose up -d            # postgres, redis, minio (+ observability)
pnpm --filter api prisma migrate dev
pnpm --filter api prisma db seed
pnpm dev                        # turbo runs web + api
```

- Web: http://localhost:3000 · API: http://localhost:4000 · API health: `/healthz`, `/readyz`.
- Prisma Studio: `pnpm --filter api prisma studio`.

## Everyday commands _(after setup)_

| Task             | Command                                                |
| ---------------- | ------------------------------------------------------ |
| Run everything   | `pnpm dev`                                             |
| Build all        | `pnpm build`                                           |
| Lint / format    | `pnpm lint` · `pnpm format`                            |
| Type-check       | `pnpm type-check`                                      |
| Test (all)       | `pnpm test`                                            |
| Test one package | `pnpm --filter api test` / `pnpm --filter web test`    |
| Test one file    | `pnpm --filter api test path/to/file.test.ts`          |
| New migration    | `pnpm --filter api prisma migrate dev --name <change>` |
| Add a changeset  | `pnpm changeset`                                       |

## Contributing flow

Read [`../CI-CD/00-git-flow.md`](../CI-CD/00-git-flow.md): branch off `development` → PR into `development` →
release PR to `main`. Include a changeset; follow Conventional Commits; pass CI + CodeRabbit + review; satisfy the
relevant [`../Checklists`](../Checklists).

## Claude Code tooling

Optional AI tooling (skills/plugins) the team uses is catalogued in [`01-claude-skills.md`](./01-claude-skills.md)
and [`02-claude-plugins.md`](./02-claude-plugins.md). Nothing there is auto-installed; run
[`../../scripts/setup-claude.sh`](../../scripts/setup-claude.sh) deliberately if you want them.
