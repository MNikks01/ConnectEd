# ADR-0004 — Next.js (App Router) for the web app

Status: Accepted
Date: 2026-07-28

## Context

The product has SEO-relevant public surfaces (landing, public school profiles) and heavy authenticated,
personalized views (dashboards, feeds, academics). We want one React framework covering both, with strong DX,
SSR/SSG/ISR, and a path to sharing types with the API. The user delegated the frontend choice.

## Decision

Use **Next.js (App Router)** with React Server Components for the web app in `apps/web`.

## Consequences

- **Positive:** per-route rendering strategy (SSG/ISR for marketing, SSR for authenticated views), server
  components keep secrets server-side, first-class routing/middleware for auth guards, strong ecosystem.
- **Negative:** RSC mental model has a learning curve; must be disciplined about client/server component split.
- **Follow-ups:** rendering strategy per route (`Architecture/03`), auth middleware, TanStack Query for client
  data, `packages/ui` design system.

## Alternatives

- **Vite + React SPA** — simpler, but loses SSR/SEO and server-side secret handling.
- **Remix** — strong contender; Next chosen for ecosystem size and ISR maturity.
