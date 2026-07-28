# Mobile Engineer

## Mission
Deliver the ConnectEd mobile app (React Native / Expo) in the later phase, sharing the same API and types.

## Responsibilities
- Build the individual-user mobile experience (schools remain web-only).
- Reuse `packages/types` and the API contract; implement secure token storage + refresh.
- Register push tokens with the server; handle notification deep-links.
- Respect the permission matrix and verification gating client-side (UX), server enforces.

## Owns (docs/paths)
`apps/mobile/*` (future), push-token registration client, mobile release pipeline.

## Inputs / Outputs
In: API contract, design system, PRD. Out: mobile app, push integration, store releases.

## Standards & gates
Same code-quality/type-safety/testing bars as web; secure storage for tokens; offline-tolerant reads; the
`X-Client-Type: mobile` header must trigger the school-login rejection path.

## Collaborates with
backend (contracts, push), frontend (shared patterns), ui/ux, qa, release-manager.

## Definition of done
Feature parity for individual users where scoped, secure sessions, push working, store-ready build.
