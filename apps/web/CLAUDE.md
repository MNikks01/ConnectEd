# CLAUDE.md — `apps/web`

The ConnectEd web app. **Next.js (App Router) + React.** Used by school admins (web-only) and individuals on
desktop.

> Status: scaffold. Target structure: [`../../.docs/Architecture/03-frontend-architecture.md`](../../.docs/Architecture/03-frontend-architecture.md).

## Structure

`app/` route groups: `(marketing)` (public, SEO), `(auth)`, `(app)` (authenticated shell) with `school/` and
role dashboards (`student|parent|teacher|principal`) + `social/`. `lib/api-client.ts` (typed, uses
`packages/types`), `lib/auth.ts`. Shared UI comes from `packages/ui`; app-specific components in `components/`.

## Rules

1. **Rendering per route:** SSR everywhere, client components only for interactive islands. Nothing is
   prerendered, and the reason is the content security policy: its nonce is minted per response, so HTML built
   at build time hydrates nothing (`lib/security-headers.ts`). Adding `export const dynamic` is not optional on
   a page with no dynamic data — it is what keeps the page working. Keep secrets server-side (never expose
   service tokens to the browser).
2. **Data:** server state via TanStack Query; forms via React Hook Form + zod. No global Redux unless justified.
3. **Types:** consume DTOs from `packages/types`; never hand-redefine API shapes (prevents drift). No `any`.
4. **Every feature ships all states:** Loading / Error / Empty / Success / Responsive / Accessible.
5. **Auth/route guards mirror the [permission matrix](../../.docs/PRD/09-permissions-matrix.md)** for UX only —
   the server is the real gate.
6. **A11y + perf:** WCAG AA; Lighthouse/a11y > 90; no horizontal scroll ≥ 320px; images WebP/AVIF + responsive.

## Commands (after setup)

```bash
pnpm --filter web dev
pnpm --filter web test
pnpm --filter web build
```

## Gate

Frontend checklist: [`../../.docs/Checklists/frontend-checklist.md`](../../.docs/Checklists/frontend-checklist.md).
