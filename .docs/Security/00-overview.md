# Security — Overview

`Status: Accepted` · `Last updated: 2026-07-28`

Security is the headline reason for the rebuild. The legacy app had **no server-side access control** and stored
**plaintext passwords**. ConnectEd targets **OWASP ASVS Level 2**.

## Pillars

1. **Server-enforced authorization** on every request (`ADR-0006`, `02-authorization.md`).
2. **Strong authentication**: argon2id hashing, rotating refresh with reuse detection (`ADR-0007`,
   `01-authentication.md`).
3. **Least privilege**: roles/verification/ownership scope every read and write.
4. **Secure by default**: secrets in a manager, TLS everywhere, safe headers, input validation, output encoding.
5. **Auditability**: sensitive actions logged immutably.
6. **Privacy & compliance**: data minimization, encryption, export/delete rights (`04-compliance.md`).

## Files

- [`01-authentication.md`](./01-authentication.md)
- [`02-authorization.md`](./02-authorization.md)
- [`03-threat-model.md`](./03-threat-model.md)
- [`04-compliance.md`](./04-compliance.md)
- [`05-review-2026-08-05.md`](./05-review-2026-08-05.md) — whole-repository review at 0.3.0

## Baseline controls (apply everywhere)

- **Transport:** HTTPS/TLS 1.2+ only; HSTS.
- **Headers:** both apps, by different means. The API sends them through `helmet()`. The web app sends
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and
  `Cross-Origin-Opener-Policy` from `next.config.mjs`, and a nonce-based `Content-Security-Policy` from
  `middleware.ts` — the nonce is per response, so it cannot come from static configuration.
- **Input:** zod validation on all inputs; parameterized queries via Prisma (no string SQL).
- **Output:** JSON only from the API; React auto-escaping on web; `dangerouslySetInnerHTML` forbidden unless
  sanitized.
- **Secrets:** never in code/repo; injected via env from a secrets manager; rotated; `.env` gitignored.
- **Rate limiting & lockout:** on auth + writes.
- **Dependencies:** automated audits (Dependabot/`pnpm audit`) in CI; SCA gate.
- **Uploads:** type/size validation, virus-scan hook, served via signed URLs only.

- [ASVS L2 walkthrough](./07-asvs-l2.md) — the standard walked as a checklist (2026-08-11); five findings, four fixed.
