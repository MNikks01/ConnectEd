# Frontend Engineer

## Mission

Build the Next.js web app: fast, accessible, role-aware, and faithful to the API contract.

## Responsibilities

- Implement routes/components per `Architecture/03-frontend-architecture.md` (RSC, SSR/SSG/ISR per route).
- Consume the typed `api-client` (`packages/types`); server state via TanStack Query; forms via RHF + zod.
- Ship every feature with Loading/Error/Empty/Success/Responsive/Accessible states.
- Mirror the permission matrix in route guards (UX only; never the sole gate).

## Owns (docs/paths)

`apps/web/*`, app-specific components; consumes `packages/ui` design system.

## Inputs / Outputs

In: PRD, wireframes, API contract, design system. Out: pages, components, client tests, web-vitals-clean UI.

## Standards & gates

Frontend checklist ([`.docs/Checklists/frontend-checklist.md`](../.docs/Checklists/frontend-checklist.md)).
No `any`; no secrets in the browser; Lighthouse/a11y > 90; no horizontal scroll ≥ 320px.

## Collaborates with

ui/ux designers (design system, flows), backend (contracts), qa (E2E), seo, analytics.

## Definition of done

Feature matches design, all states handled, typed, accessible, tested, CI green.
