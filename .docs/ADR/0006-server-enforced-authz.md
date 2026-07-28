# ADR-0006 — Server-enforced authorization

Status: Accepted
Date: 2026-07-28

## Context

The legacy app had **no Firestore/Storage security rules**; access control was purely client-side UI gating and
query construction. Any client could read/write outside intended bounds. This is the single most important defect
the rebuild must fix. The product depends on a hard guarantee: *no member sees a class's academics without
server-verified membership.*

## Decision

**All authorization is enforced on the server**, in the domain service layer, on every request — evaluated
against (a) the authenticated actor's role/account type, (b) verification state for the relevant class/child, and
(c) resource ownership. The client's role guards are **defense-in-depth only**, never the sole gate. The
[permission matrix](../PRD/09-permissions-matrix.md) is the contract; integration tests assert it endpoint by
endpoint.

## Consequences

- **Positive:** closes the legacy governance gap; access is provable and testable; a compromised/hacked client
  cannot exceed its permissions.
- **Negative:** every endpoint carries authorization logic and tests; more work per feature. Mitigated by shared
  authorization helpers/policies and a permission test matrix.
- **Follow-ups:** `Security/02-authorization.md` defines the policy helpers; CI requires permission tests for new
  endpoints (checklist gate).

## Alternatives

- **Client-side gating (legacy)** — rejected outright; it is the vulnerability.
- **Database RLS (Postgres row-level security)** — powerful, considered as an *additional* layer later; v1
  enforces in the service layer for clarity and testability. Revisit in a future ADR if we expose the DB more
  directly.
