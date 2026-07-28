# Security — Authentication

`Status: Accepted` · `Last updated: 2026-07-28`

Implements `ADR-0007`.

## Password storage

- **argon2id** (memory-hard) with tuned params; **bcrypt(cost≥12)** fallback where argon2 unavailable.
- Plaintext passwords are **never** persisted or logged. (Reverses legacy `USER_PWD`/`SCHOOL_PASSWORD`.)
- Password policy: min length + breach-list check (k-anonymity against HIBP-style API optional); no composition
  nonsense that harms usability.

## Tokens

| Token | Type | TTL | Storage | Notes |
|---|---|---|---|---|
| Access | JWT (signed, `RS256`/`EdDSA`) | ~15 min | in-memory (web), secure store (mobile) | claims: `sub`, `accountType`, `role`, compact verified-contexts |
| Refresh | opaque random | ~30 days | httpOnly+Secure+SameSite cookie (web); body (mobile) | rotating **family**, stored hashed server-side |

- **Rotation + reuse detection:** each refresh mints a new token and invalidates the prior; presenting a used
  token revokes the whole family (theft response).
- **Sensitive operations** (billing, member removal, role change) re-verify authorization against the DB rather
  than trusting stale JWT claims.
- **Signing keys** from the secrets manager; support key rotation (JWKS with `kid`).

## Flows

- **Register** → create account + hashed credential → email verification token (expiring).
- **Login** → verify hash → issue tokens; **reject `SCHOOL` when `X-Client-Type: mobile`** (`SCHOOL_WEB_ONLY`).
- **Refresh** → validate + rotate (reuse detection).
- **Logout** → revoke refresh family; clear cookie.
- **Password reset** → single-use, expiring token; on reset revoke all sessions.
- **2FA (P2)** → optional TOTP for school admins/principals; recovery codes.

## Abuse protection

- Rate-limit + exponential backoff on login/refresh/reset; account lockout on repeated failure with alerting.
- Generic auth error messages (no user enumeration).
- Log auth events (success/failure) with correlation IDs; never log secrets/tokens.
