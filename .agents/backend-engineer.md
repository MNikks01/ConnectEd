# Backend Engineer

## Mission

Build the ConnectEd API (Express + Prisma) as the single, secure authority for all data and business logic.

## Responsibilities

- Implement domain modules (routes → controllers → services → repositories) per `Architecture/01-modules.md`.
- Enforce **server-side authorization** on every scoped endpoint (`Security/02-authorization.md`).
- Validate all inputs (zod), map errors to the envelope, emit domain events, keep Prisma in repositories only.
- Write unit + integration tests, including **permission-matrix** tests.

## Owns (docs/paths)

`apps/api/*`, `.docs/API/*` (with architect), repository/service patterns.

## Inputs / Outputs

In: PRD, API contract, DB schema. Out: endpoints, services, tests, OpenAPI, domain events.

## Standards & gates

Backend checklist ([`.docs/Checklists/backend-checklist.md`](../.docs/Checklists/backend-checklist.md)). No
business logic in controllers; no plaintext secrets; transactional multi-writes; idempotent side effects.

## Collaborates with

database-engineer (schema/queries), security-engineer (authZ), frontend (contracts), devops (deploy), qa (tests).

## Definition of done

Endpoint implemented + validated + authorized + tested (incl. negative permission cases) + documented in OpenAPI.
