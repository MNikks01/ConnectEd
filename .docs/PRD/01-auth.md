# PRD — Accounts & Authentication

`Status: Accepted` · `Last updated: 2026-07-28`

Actors: all. Establishes identity, account type, role, and session.

## Account model

- Two account types: **`INDIVIDUAL`** and **`SCHOOL`**.
- An `INDIVIDUAL` carries a **role**: `STUDENT | PARENT | TEACHER | PRINCIPAL | USER` (`USER` = general).
- A `SCHOOL` has no role; it is the institution.

## Requirements

| ID | Priority | Requirement | Acceptance criteria |
|---|:--:|---|---|
| FR-AUTH-001 | P0 | Individuals can register with full name, email, password, mobile, gender, DOB. | Unique email enforced; password strength validated; account created in `INDIVIDUAL` type with role `USER` by default. |
| FR-AUTH-002 | P0 | Schools can register (web only) with school name, admin name, email, password, contact + address. | Account created in `SCHOOL` type; login from mobile client rejected with a clear message. |
| FR-AUTH-003 | P0 | Passwords are stored **hashed** (argon2id preferred, bcrypt fallback). | No plaintext password ever persisted or logged. Reverses legacy `USER_PWD`/`SCHOOL_PASSWORD`. |
| FR-AUTH-004 | P0 | Login with email + password returns a session. | Valid creds → access token (short-lived) + refresh token (rotating). Invalid → 401, generic message. |
| FR-AUTH-005 | P0 | Refresh-token rotation with reuse detection. | Using a rotated/revoked refresh token invalidates the session family and forces re-login. |
| FR-AUTH-006 | P0 | Logout revokes the refresh token and clears client sessions. | Subsequent refresh with revoked token → 401. |
| FR-AUTH-007 | P0 | After login, the client is routed by account type/role. | School → school portal (web); mobile school login → rejected; individual → user experience by role. |
| FR-AUTH-008 | P1 | Individuals can declare/switch academic role (Student/Parent/Teacher/Principal). | Role change creates the role profile and (if academic) a `PENDING` verification against a chosen school. |
| FR-AUTH-009 | P1 | Password reset via emailed, expiring, single-use token. | Token expires (≤ 30 min), single use; reset invalidates existing sessions. |
| FR-AUTH-010 | P1 | Email verification on registration. | Unverified accounts have limited capability until email confirmed. |
| FR-AUTH-011 | P2 | Rate-limiting & brute-force protection on auth endpoints. | Repeated failures throttled; lockout/backoff applied; events logged. |
| FR-AUTH-012 | P2 | Optional 2FA (TOTP) for school admins & principals. | Enrolment + verification; recovery codes issued. |

## Session design (summary — full detail in Security)

- **Access token:** JWT, ~15 min TTL, carries `sub`, `accountType`, `role`, `verifiedContexts` claim summary.
- **Refresh token:** opaque, httpOnly cookie (web), rotating, stored hashed server-side, per-family reuse detection.
- Authorization decisions are re-checked server-side against the DB, not trusted from the token alone for
  sensitive operations.

## Edge cases

- Duplicate email across account types → rejected (email is globally unique).
- Role switch while an academic role is still verified elsewhere → previous role profile retained but inactive;
  documented in verification module.
- Deactivated/suspended school → members retain social access; academic access frozen.
