# ADR-0005 — Express + Prisma for the API

Status: Accepted
Date: 2026-07-28

## Context

We need a Node.js HTTP API over PostgreSQL. The user chose **Express + Prisma**. Express is ubiquitous and
unopinionated; Prisma gives a type-safe schema, migrations, and a typed client that pairs well with our
strict-TS, type-sharing goals.

## Decision

Build the API on **Express** with **Prisma ORM**. Impose structure ourselves (the framework won't) via the
modular-monolith layout in `Architecture/01-modules.md`: routes → controllers → services → repositories, with
Prisma confined to repositories.

## Consequences

- **Positive:** full control, huge ecosystem, Prisma's typed client + migrations + schema as source of truth,
  easy to test services in isolation.
- **Negative:** Express gives no built-in structure/DI/validation — we must enforce conventions in review and
  lint (this is why module boundaries are documented explicitly). Prisma adds a query engine binary to images.
- **Follow-ups:** zod for request validation, a repository interface pattern, transaction helpers, error
  middleware, OpenAPI generation from zod (`API/`).

## Alternatives

- **NestJS** — more structure out of the box, but the user chose Express; we replicate the useful structure by
  convention.
- **Fastify + Drizzle** — faster/SQL-first, but the team chose Express + Prisma for DX and familiarity.
- **Knex/raw SQL** — more control, less type safety and slower delivery than Prisma.
