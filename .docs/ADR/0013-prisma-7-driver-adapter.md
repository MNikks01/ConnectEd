# ADR-0013 — Prisma 7 with the `pg` driver adapter

Status: Accepted
Date: 2026-07-31

## Context

`ADR-0005` chose Prisma without pinning a major version. When the schema landed (S0-6), the current release was
**Prisma 7.9.1**, which changes how the client connects:

- `url = env("DATABASE_URL")` is **no longer allowed** in the `datasource` block. `prisma validate` fails
  outright, so this is not a soft deprecation.
- CLI connection details (migrate, studio, introspect) move to a **`prisma.config.ts`** file.
- The runtime client connects through a **driver adapter** rather than an embedded Rust query engine.
- The generated client goes to a project path rather than `node_modules/@prisma/client`.

`Database/02-migrations.md` was written against the Prisma 6 workflow and describes the old arrangement.

## Decision

Adopt **Prisma 7** with **`@prisma/adapter-pg`** over `pg`.

- `apps/api/prisma.config.ts` holds the CLI datasource and the seed command.
- The runtime connection string is supplied to `createDb()` in `apps/api/src/shared/db`, which builds the
  adapter. Nothing reads the database URL from the schema.
- The client is generated to `apps/api/src/generated/prisma`, gitignored, and rebuilt by a `postinstall` hook so
  CI has it before type-check.

## Consequences

- **Positive:** no Rust query-engine binary in the image (smaller, one less arch-specific artifact); the
  connection is a normal `pg` pool we can tune, instrument, and share; we start the rebuild on the current major
  rather than scheduling a v7 migration a few months in.
- **Negative:** more moving parts than v6 — a config file, an adapter, and a generated-code path that must be
  gitignored and regenerated. `postinstall` becomes load-bearing for CI.
- **Negative:** `.docs/Database/02-migrations.md` had to be corrected; anyone reading the pre-2026-07-31 version
  will expect `url` in the schema.
- **Follow-ups:** pool sizing (`connection_limit`) belongs in the adapter options once we have load numbers;
  OpenTelemetry Prisma instrumentation should be confirmed against the adapter path, since auto-instrumentation
  previously hooked the engine.

## Alternatives

- **Pin Prisma 6.19.3** — matches the docs as originally written and needs no adapter. Rejected: it front-loads
  no work but guarantees a forced migration on a codebase that is days old, which is the cheapest moment to
  absorb it.
- **Prisma 7 without an adapter** — not available; v7 requires either a driver adapter or Accelerate.
