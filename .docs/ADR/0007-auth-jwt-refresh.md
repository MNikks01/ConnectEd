# ADR-0007 — JWT access + rotating refresh tokens, argon2id hashing

Status: Accepted
Date: 2026-07-28

## Context

Legacy stored **plaintext passwords** in Firestore alongside Firebase Auth — a critical vulnerability. The
rebuild owns auth end-to-end and must be secure by default, stateless-friendly, and support web (cookies) now and
mobile later.

## Decision

- **Password hashing:** argon2id (bcrypt as fallback where argon2 unavailable). Never store or log plaintext.
- **Access token:** short-lived JWT (~15 min) carrying `sub`, `accountType`, `role`, and a compact
  verified-contexts summary. Sensitive operations re-check authorization against the DB, not the token alone.
- **Refresh token:** opaque, rotating, stored **hashed** server-side as a token *family*; **reuse detection**
  revokes the whole family. Delivered as an httpOnly, Secure, SameSite cookie on web; returned in body for mobile.
- **Logout / reset** revoke the refresh family and force re-auth.

## Consequences

- **Positive:** closes the plaintext-password hole; stateless access tokens scale horizontally; rotation + reuse
  detection limits stolen-token blast radius.
- **Negative:** refresh-family bookkeeping in Redis/DB; clock-skew and revocation-latency considerations for JWTs
  (mitigated by short TTL + DB re-checks on sensitive ops).
- **Follow-ups:** `Security/01-authentication.md` details token claims, storage, and rotation; optional TOTP 2FA
  for admins/principals.

## Alternatives

- **Server-side sessions only** — simpler revocation but less horizontal-scale-friendly; we use short JWT + DB
  re-check to get most of both.
- **Long-lived JWT without refresh** — rejected: no revocation, large blast radius.
