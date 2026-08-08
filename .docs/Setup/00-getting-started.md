# Getting Started

`Status: Accepted` · `Last updated: 2026-08-08`

From a fresh clone to a running product with data in it. Everything here was run against
`development` on 2026-08-06; where a command has a trap in it, the trap is written down rather than
left to be discovered.

## Prerequisites

- **Node.js** ≥ 20 LTS
- **pnpm** ≥ 9 — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker** + Compose — Postgres, Redis and MinIO run in containers; the app processes run on the
  host. (There is also a compose file that runs _everything_ in containers — see below.)
- **Git** with access to `github.com/MNikks01/ConnectEd`

## First run

```bash
git clone https://github.com/MNikks01/ConnectEd.git
cd ConnectEd
pnpm install                      # postinstall runs `prisma generate`
cp .env.example .env              # the defaults work as-is for local development
docker compose up -d              # postgres, redis, minio
pnpm --filter @connected/api db:migrate
pnpm --filter @connected/api db:seed
pnpm dev                          # turbo runs api (:4000) and web (:3000)
```

- Web **http://localhost:3000** · API **http://localhost:4000** · health `/healthz`, `/readyz`
- MinIO console **http://localhost:9001** (`minioadmin` / `minioadmin`)
- The media bucket is created by the API at boot (`ensureBucket()`), so there is nothing to click.

### Or: the whole thing, from images

If you want to _use_ the product rather than edit it — a demo, a first look, checking that it starts
from nothing — there is a second compose file that runs everything, including the API, the worker
and the web app:

```bash
docker compose -f infrastructure/docker/compose.yml up --build
```

Sign in at **http://localhost:3000**. No Node, no pnpm, no `.env`, and no migration step to
remember: a migration container runs first and everything else waits for it to finish.

It is not the development loop — a rebuilt image per keystroke is not one — and the two do not
collide, because that file publishes only 3000 and 4000. What it is good for is the question the
first run above cannot answer: _does this start on a machine that has never seen it?_

Its arrangement is the deployed one rather than a convenient one: the worker is a separate
container and the API runs with `RUN_WORKER_IN_PROCESS=false`, which is what ADR-0019 assumes and
what every test has used since S7-17.

**`.env` as shipped is enough.** Every required variable has a working local default, including an
HS256 development secret. Asymmetric signing (Ed25519 + JWKS, ADR-0014) is what deployed
environments use; leave those keys unset locally and the API falls back to HS256 and publishes an
empty JWKS on purpose, so a symmetric secret can never leak through it.

## Signing in

The seed prints its credentials when it finishes. All demo accounts share one obviously-fake
password, **`DemoPassw0rd!`**:

| Account                    | Role                                        |
| -------------------------- | ------------------------------------------- |
| `admin@greenwood.test`     | the school itself — **web only**, by design |
| `principal@greenwood.test` | principal                                   |
| `teacher@greenwood.test`   | teacher                                     |
| `student@greenwood.test`   | student                                     |
| `parent@greenwood.test`    | parent                                      |

The seed is idempotent — it upserts on email, so re-running it does not accumulate duplicates.

## The worker is a separate process

`pnpm dev` starts the **API and the web app only**. Notification fan-out runs on a BullMQ worker:

```bash
pnpm --filter @connected/api worker:dev
```

Without it, academic writes still succeed and their events still queue — nothing errors, and no
notification is ever delivered. This is the single most confusing thing about a local run, because
the product looks like it is working.

## Everyday commands

| Task                  | Command                                                      |
| --------------------- | ------------------------------------------------------------ |
| Run api + web         | `pnpm dev`                                                   |
| Run the worker        | `pnpm --filter @connected/api worker:dev`                    |
| Build everything      | `pnpm build`                                                 |
| Lint · format         | `pnpm lint` · `pnpm format` (`format:check` is what CI runs) |
| Type-check            | `pnpm type-check`                                            |
| Test everything       | `pnpm test`                                                  |
| API tests only        | `pnpm --filter @connected/api test`                          |
| One test file         | `pnpm --filter @connected/api test path/to/file.test.ts`     |
| End-to-end            | `pnpm --filter @connected/web test:e2e`                      |
| End-to-end, watched   | `pnpm --filter @connected/web test:e2e:ui`                   |
| Smoke a running stack | `pnpm --filter @connected/web test:smoke`                    |
| New migration         | `pnpm --filter @connected/api db:migrate --name <change>`    |
| Prisma Studio         | `pnpm --filter @connected/api db:studio`                     |
| Reset the database    | `pnpm --filter @connected/api db:reset`                      |
| Grant platform admin  | `pnpm --filter @connected/api admin:grant <email>`           |
| Add a changeset       | `pnpm changeset`                                             |

Filters use the **package name** (`@connected/api`, `@connected/web`), not the folder.

## End-to-end tests

```bash
pnpm build                                   # the suite runs against built output, not the dev server
pnpm --filter @connected/web test:e2e
```

Playwright starts both servers itself, so that is the whole command. Two things worth knowing:

- It uses a **separate database**, `connected_e2e`, and empties it. Point `DATABASE_URL` at your
  development database and it will delete your data.
- It runs against `next start` and `node dist/index.js` deliberately. The dev server papers over
  build-time failures, which is exactly the class of bug this suite is meant to catch — so a stale
  build means you are testing yesterday's code.

## Observability (optional)

```bash
docker compose --profile observability up -d
```

Grafana **http://localhost:3001** (anonymous admin locally), Prometheus `:9090`, Alertmanager
`:9093`, Loki `:3100`, Tempo `:3200`. Dashboards and alert rules are mounted read-only from
`infrastructure/` — they are code, so edits made in the Grafana UI are discarded on restart by
design. Alerts land in a null receiver locally; the point is that you can watch one fire.

## When it does not work

**Port 6379 already in use / the queue behaves oddly.** A Redis installed by Homebrew or as a system
service will hold `6379`, and the compose `redis` container then cannot bind — leaving the app
talking to a Redis nobody configured. `docker compose ps` will show it unhealthy or restarting.
Stop the host one (`brew services stop redis`) rather than moving the port.

**`prisma` cannot find the client / type errors in `src/generated`.** The client is generated into
`src/` and gitignored, so it must exist before anything type-checks. `pnpm install` runs
`prisma generate` in `postinstall`; run it directly if a checkout left it missing.

**The API refuses to boot.** Configuration is validated with zod at startup and it fails loudly on
purpose — read the message, it names the variable. `JWT_ACCESS_SECRET` under 32 characters and
missing S3 settings are the usual two. Nothing falls back to a silent default.

**Migrations will not apply.** `db:migrate` (`prisma migrate dev`) is for development and may reset;
`db:deploy` (`prisma migrate deploy`) is the non-destructive one CI and production use. Never run
`migrate dev` against anything you care about — see [`../Database/02-migrations.md`](../Database/02-migrations.md).

## Contributing

Read [`../CI-CD/00-git-flow.md`](../CI-CD/00-git-flow.md): branch off `development` → PR into
`development` → release PR to `main`. Conventional Commits, a changeset per PR that changes
shippable packages (an **empty** one for private packages), and the relevant
[`../Checklists`](../Checklists) satisfied.

Both branches are protected: a pull request and five passing checks are required, and force pushes
and deletions are refused. Husky runs `lint-staged` and `type-check` before a commit — a commit that
skips the hook is formatted by nothing, and CI will fail on `format:check`.

## Claude Code tooling

Optional AI tooling the team uses is catalogued in [`01-claude-skills.md`](./01-claude-skills.md) and
[`02-claude-plugins.md`](./02-claude-plugins.md). Nothing is auto-installed; run
[`../../scripts/setup-claude.sh`](../../scripts/setup-claude.sh) deliberately if you want it.
