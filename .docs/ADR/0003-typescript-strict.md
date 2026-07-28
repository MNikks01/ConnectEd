# ADR-0003 — TypeScript strict everywhere

Status: Accepted
Date: 2026-07-28

## Context

Type safety across the API/web boundary is a primary reason for the monorepo. Half-typed code erodes that value.

## Decision

**TypeScript in `strict` mode** for all packages. Shared base `tsconfig` in `packages/config`. `any` is
disallowed (lint error) except at explicitly annotated boundaries with justification. API responses, component
props, hooks, and global state are all typed. Runtime validation (zod) guards all external inputs and derives
static types.

## Consequences

- **Positive:** compile-time safety, better refactoring, self-documenting contracts, zod bridges runtime↔types.
- **Negative:** more upfront typing effort; third-party libs with poor types need shims.
- **Follow-ups:** ESLint `@typescript-eslint` strict rules; CI type-check gate (`tsc --noEmit`).

## Alternatives

- **JavaScript / loose TS** — rejected: defeats the monorepo type-sharing rationale and the checklist's type-safety gate.
