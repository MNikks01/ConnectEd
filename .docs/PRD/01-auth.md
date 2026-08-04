# PRD — Accounts & Authentication

`Status: Accepted` · `Last updated: 2026-08-04`

Actors: all. Establishes identity, account type, role, and session.

## Account model

- Two account types: **`INDIVIDUAL`** and **`SCHOOL`**.
- An `INDIVIDUAL` carries a **role**: `STUDENT | PARENT | TEACHER | PRINCIPAL | USER` (`USER` = general).
- A `SCHOOL` has no role; it is the institution.

## Requirements

| ID          | Priority | Requirement                                                                                       | Acceptance criteria                                                                                                   |
| ----------- | :------: | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| FR-AUTH-001 |    P0    | Individuals can register with full name, email, password, mobile, gender, DOB.                    | Unique email enforced; password strength validated; account created in `INDIVIDUAL` type with role `USER` by default. |
| FR-AUTH-002 |    P0    | Schools can register (web only) with school name, admin name, email, password, contact + address. | Account created in `SCHOOL` type; login from mobile client rejected with a clear message.                             |
| FR-AUTH-003 |    P0    | Passwords are stored **hashed** (argon2id preferred, bcrypt fallback).                            | No plaintext password ever persisted or logged. Reverses legacy `USER_PWD`/`SCHOOL_PASSWORD`.                         |
| FR-AUTH-004 |    P0    | Login with email + password returns a session.                                                    | Valid creds → access token (short-lived) + refresh token (rotating). Invalid → 401, generic message.                  |
| FR-AUTH-005 |    P0    | Refresh-token rotation with reuse detection.                                                      | Using a rotated/revoked refresh token invalidates the session family and forces re-login.                             |
| FR-AUTH-006 |    P0    | Logout revokes the refresh token and clears client sessions.                                      | Subsequent refresh with revoked token → 401.                                                                          |
| FR-AUTH-007 |    P0    | After login, the client is routed by account type/role.                                           | School → school portal (web); mobile school login → rejected; individual → user experience by role.                   |
| FR-AUTH-008 |    P1    | Individuals can declare/switch academic role (Student/Parent/Teacher/Principal).                  | Role change creates the role profile and (if academic) a `PENDING` verification against a chosen school.              |
| FR-AUTH-009 |    P1    | Password reset via emailed, expiring, single-use token.                                           | **Built.** 30-minute expiry, single use, revokes every session. No mail transport yet — see below.                    |
| FR-AUTH-010 |    P1    | Email verification on registration.                                                               | Unverified accounts have limited capability until email confirmed.                                                    |
| FR-AUTH-011 |    P2    | Rate-limiting & brute-force protection on auth endpoints.                                         | Repeated failures throttled; lockout/backoff applied; events logged.                                                  |
| FR-AUTH-012 |    P2    | Optional 2FA (TOTP) for school admins & principals.                                               | Enrolment + verification; recovery codes issued.                                                                      |

## Password reset (FR-AUTH-009)

Built, and deliberately built without waiting for a mail transport — the mechanics are the
substance, and none of them depend on how the message leaves the process:

- `POST /auth/password/forgot` answers **202 with an empty body, always**. Registered, unregistered,
  or registered-but-the-send-failed are indistinguishable. It is unauthenticated and strangers will
  call it; anything else is a way to ask "does this person have an account here?".
- The token is 32 random bytes and is **stored hashed**, exactly as refresh tokens are.
- Spending it is one statement whose `where` carries every condition, so two concurrent requests
  cannot both find it unspent. It revokes **every** session and invalidates any other outstanding
  link for that account.
- Reset does **not** sign the user in — that would make a stolen link a stolen session.
- Unknown, expired, and already-spent give the **same** answer.

**No transport is configured.** `MAIL_TRANSPORT` is `console` (prints the link; refuses to
construct itself in production, because a live token in a log aggregator is a retained credential)
or `none` (sends nothing and says so at error level). Choosing a real one is a deployment decision
that deserves its own ADR.

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
