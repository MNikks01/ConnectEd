# Security — Authentication

`Status: Accepted` · `Last updated: 2026-08-02`

Implements `ADR-0007`.

## Password storage

- **argon2id** (memory-hard) with tuned params; **bcrypt(cost≥12)** fallback where argon2 unavailable.
- Plaintext passwords are **never** persisted or logged. (Reverses legacy `USER_PWD`/`SCHOOL_PASSWORD`.)
- Password policy: min length + breach-list check (k-anonymity against HIBP-style API optional); no composition
  nonsense that harms usability.

## Tokens

| Token   | Type                          | TTL      | Storage                                              | Notes                                                           |
| ------- | ----------------------------- | -------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| Access  | JWT (signed, `RS256`/`EdDSA`) | ~15 min  | in-memory (web), secure store (mobile)               | claims: `sub`, `accountType`, `role`, compact verified-contexts |
| Refresh | opaque random                 | ~30 days | httpOnly+Secure+SameSite cookie (web); body (mobile) | rotating **family**, stored hashed server-side                  |

- **Rotation + reuse detection:** each refresh mints a new token and invalidates the prior; presenting a used
  token revokes the whole family (theft response).
- **Sensitive operations** (billing, member removal, role change) re-verify authorization against the DB rather
  than trusting stale JWT claims.
- **Signing keys** from the secrets manager; support key rotation (JWKS with `kid`).

> **Implemented as of S3-10 (`ADR-0014`).** Access tokens are signed **Ed25519 (EdDSA)** when a key pair is
> configured, with a `kid` in every header and the public key published at `/.well-known/jwks.json` — so a
> verifier never needs the signing key. Rotation is an overlap: `JWT_PREVIOUS_PUBLIC_KEY` keeps the outgoing key
> verifiable while its tokens expire, and JWKS publishes both.
>
> **HS256 with `JWT_ACCESS_SECRET` remains the default for local development**, so nothing but a secret is
> needed to run the API. The two modes never mix — the algorithm is pinned to exactly one value at verification,
> and the JWKS route is absent rather than empty when signing is symmetric.
>
> Refresh tokens are unaffected and already as described: opaque, 256-bit random, stored as a SHA-256 digest,
> rotating per family with reuse detection.
>
> **Still open:** key material is a deployment concern — generated, stored in the secret manager, and rotated on
> a schedule. Production has no key pair configured yet, so it runs HS256 until one is provisioned.

## Flows

- **Register** → create account + hashed credential → email verification token (expiring).
- **Login** → verify hash → issue tokens; **reject `SCHOOL` when `X-Client-Type: mobile`** (`SCHOOL_WEB_ONLY`).
- **Refresh** → validate + rotate (reuse detection).
- **Logout** → revoke refresh family; clear cookie.
- **Two-factor (TOTP)** → **built** for school and principal accounts (FR-AUTH-012). Secret
  encrypted at rest with `TWO_FACTOR_KEY`; enrolment inert until a first correct code; login
  returns a five-minute single-use challenge rather than a session; ten hashed recovery codes;
  disabling requires a current code. The implementation is checked against RFC 6238's published
  test vectors.
- **Password reset** → single-use, expiring token; on reset revoke all sessions. **Built**, with
  these properties asserted:
  - The response to `/auth/password/forgot` is **identical** whether the address is registered,
    unregistered, or registered-but-the-mail-failed. It is unauthenticated and strangers will call
    it; anything that answers differently is an account-enumeration oracle.
  - The token is **stored hashed** (SHA-256), exactly as refresh tokens are. A database dump must
    not hand over live reset links.
  - Spending one is a single `updateMany` whose `where` carries every condition, so two concurrent
    requests cannot both find it unspent.
  - It **revokes every refresh-token family**, not only the current one — somebody resetting a
    password may be doing it _because_ someone else is in their account — and **invalidates any
    other outstanding reset link** for that account.
  - Reset does **not** sign the user in. Convenient, and it would make a stolen link a stolen
    session.
  - Unknown, expired, and already-spent produce the **same** error, so somebody holding a stolen
    link cannot learn which part to work on.

  **No mail transport is configured** (`MAIL_TRANSPORT` is `console` or `none`, defaulting to
  `none`). Choosing one is a deployment decision that wants its own ADR; everything around sending
  is built and tested. The console transport prints the token and **refuses to construct itself in
  production**, because a live reset token in a log aggregator is a retained, searchable
  credential.

- **2FA (P2)** → optional TOTP for school admins/principals; recovery codes.

## Abuse protection

- Rate-limit + exponential backoff on login/refresh/reset. **Built**, and deliberately _not_ as
  lockout: a block that never lifts is a denial of service against any account whose address is
  known. Two layers — a per-IP limiter on the routes, and a per-address backoff that survives an
  attacker rotating addresses. The per-address counter is keyed on a hash and applies whether or
  not the account exists, so it cannot be used to enumerate.
- Generic auth error messages (no user enumeration).
- Log auth events (success/failure) with correlation IDs; never log secrets/tokens.
