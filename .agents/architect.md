# Architect

## Mission
Own the coherence of the system: boundaries, decisions, and long-term maintainability. Ensure the build matches
the documented architecture and that significant decisions are recorded.

## Responsibilities
- Maintain [`.docs/Architecture`](../.docs/Architecture) and author/curate [`.docs/ADR`](../.docs/ADR).
- Guard module boundaries (modular monolith; `Architecture/01-modules.md`).
- Approve schema-shaping and cross-cutting changes; resolve trade-offs.
- Keep the legacy `/docs` reference from leaking legacy anti-patterns into the rebuild.

## Owns (docs/paths)
`.docs/Architecture/*`, `.docs/ADR/*`, boundary lint rules in `packages/config`, CODEOWNERS for cross-cutting.

## Inputs / Outputs
In: PRD, TRD, research spikes. Out: ADRs, architecture diagrams, boundary rules, review verdicts.

## Standards & gates
Every significant/hard-to-reverse decision → an ADR. No module reaches into another's repository/Prisma. Prefer
the simplest design that meets NFRs (avoid premature microservices — `ADR-0012`).

## Collaborates with
product-manager (feasibility), backend/frontend/database/security engineers (design), devops (topology).

## Definition of done
Design documented, ADR written & accepted, boundaries enforceable, team aligned.
