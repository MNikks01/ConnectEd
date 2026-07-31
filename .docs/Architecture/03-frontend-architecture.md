# Architecture — Frontend (Next.js)

`Status: Accepted` · `Last updated: 2026-07-31`

## Framework & rendering

- **Next.js App Router** with React Server Components.
- Rendering strategy per route:
  - **SSR** for authenticated, personalized views (feeds, dashboards, academics).
  - **SSG/ISR** for marketing/public pages (landing, school public profiles) — SEO-critical.
  - **Client components** for interactive islands (composer, message thread, notification bell).
- Server Components fetch via a server-side API client (never expose service tokens to the browser).

## App structure (`apps/web`)

```
app/
  (marketing)/            # public, SSG/ISR
  (auth)/                 # login, register, reset
  (app)/                  # authenticated shell
    school/               # school portal (web-only account)
    student/ parent/ teacher/ principal/   # role dashboards
    social/               # feed, profile, messages
  api/                    # route handlers (BFF proxy where needed)
lib/
  api-client.ts           # typed fetch wrapper (uses packages/types)
  auth.ts                 # session helpers
components/               # app-specific components (shared ones in packages/ui)
```

## State management

- **Server state**: TanStack Query (React Query) — caching, revalidation, retries, optimistic updates.
- **Local/UI state**: React state + `useReducer`; Context only for cross-cutting (theme, current role/child).
- **No global Redux store** unless a concrete need arises (kept out per the frontend checklist "Redux only when
  necessary").
- **Forms**: React Hook Form + zod (schemas shared with the API via `packages/types` where possible).

## Cross-cutting

- **Design system** in `packages/ui` (tokens, primitives) — see UI/UX agents and `frontend-checklist`.
- **Auth**: httpOnly refresh cookie + in-memory access token; middleware guards protected routes; role-based
  route guards mirror the server permission matrix (defense in depth, never the sole gate).

> **Implemented as of S0-8, with two deviations.**
>
> 1. **The browser never calls the API directly.** It calls this app's route handlers under `app/api/auth/*`,
>    which forward to the API and re-issue the session on the Next origin. The API sets its refresh cookie for
>    its own origin and path, which a browser will not return cross-origin without `SameSite=None; Secure` —
>    unworkable over local http and weaker on CSRF in production. This is the "BFF proxy where needed" noted in
>    the structure above.
> 2. **The access token is an httpOnly cookie, not in memory.** In-memory suits a client-rendered app; Server
>    Components have no browser memory and must call the API during SSR. An httpOnly cookie is also strictly
>    less exposed — script cannot read it, so an XSS bug cannot exfiltrate it. Refresh **must** go through a
>    route handler, because Server Components cannot set cookies and the API rotates the refresh token on every
>    use; failing to persist the replacement would present a spent token and trip reuse detection.

- **Every feature ships** Loading / Error / Empty / Success / Responsive / Accessible states (checklist gate).
- **i18n** ready (English + Hindi); copy externalised.
- **Observability**: web vitals + error tracking (Sentry-style) + product analytics events.

## Type sharing

Request/response DTOs live in `packages/types`, generated/derived from the API's zod schemas so the client and
server cannot drift. The typed `api-client` consumes them.
