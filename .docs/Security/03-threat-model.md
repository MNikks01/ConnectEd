# Security — Threat Model

`Status: Accepted` · `Last updated: 2026-08-01`

STRIDE-based, focused on the assets that matter: student/parent PII, academic data, credentials, and the
verification boundary.

## Assets

- Credentials & sessions.
- Minor (student) PII and academic records.
- The verification boundary (who may see a class's data).
- Media (profile pics, homework attachments).
- Billing/subscription data.

## Trust boundaries

Browser/mobile ⇄ API (untrusted client) · API ⇄ DB/Redis/Storage (trusted network) · API ⇄ payment/push
providers (external).

## STRIDE

| Threat                     | Example                                         | Mitigation                                                                                             |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Spoofing**               | Forged identity / stolen token                  | Strong auth, short-lived JWT, refresh rotation + reuse detection, TLS.                                 |
| **Tampering**              | Client alters role/verification to read a class | Server-side authZ (`ADR-0006`); never trust client claims for scoped data; DB constraints.             |
| **Repudiation**            | Deny approving/removing a member                | `audit_log` with actor + timestamp on all sensitive actions.                                           |
| **Information disclosure** | Enumerate resources; leak PII/stack traces      | 404-for-out-of-scope; scoped queries; no internals in errors; PII minimization; signed URLs for media. |
| **Denial of service**      | Auth brute force, spam, hot endpoints           | Rate limiting, lockout/backoff, pagination caps, queue-based fan-out, WAF/CDN in prod.                 |
| **Elevation of privilege** | Student acts as teacher/school                  | Least-privilege policies + verification checks + permission test matrix.                               |

## Abuse cases specific to ConnectEd

- **Fake verification requests** → schools approve manually; rate-limit re-applications; audit repeated rejects.
- **Cross-class snooping** → membership scoping on every academic read; negative permission tests.
- **Parent accessing a non-child** → `assertParentOfVerifiedChild`.
- **Teacher publishing outside allocation** → `assertTeacherAllocatedToSubject`.
- **Minor safety** → social features moderated (report/block); content soft-deleted for review.

## Cross-site request forgery

**CodeQL reports `js/missing-token-validation` (high) against `apps/api/src/app.ts` — the API uses
`cookie-parser` with no CSRF middleware. The finding is accurate about the code and does not describe a
reachable attack here.** Recorded rather than dismissed silently, so the reasoning can be re-checked when any
of its premises change.

Why the usual attack does not apply:

| Premise CSRF needs                              | Reality here                                                                                                                                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The server authenticates from an ambient cookie | Every scoped endpoint reads `Authorization: Bearer`. A cross-site page cannot set that header, so no academic, institution, or verification route is reachable.                                                           |
| A cookie the browser attaches automatically     | The only cookie the API reads is the refresh token, on `POST /auth/refresh` and `POST /auth/logout`. It is `httpOnly`, `secure` in production, and now `SameSite=Strict` — no cross-site request of any kind presents it. |
| A browser that sends the request                | The web app never calls the API from the browser. It goes through its own server, which sends the refresh token in the body, so this cookie is not part of any client flow we ship.                                       |

**This stops being true if** an endpoint starts authenticating from a cookie, a cookie-read route is exposed
over `GET`, or the browser is ever pointed at the API directly. Any of those needs a real CSRF defence —
double-submit token, or an `Origin`/`Sec-Fetch-Site` check on cookie-authenticated routes — before it ships.

## Practices

- Threat-model new features (security-engineer agent reviews design docs).
- Dependency & container scanning in CI; secret scanning (already on for the GitHub repo).
- Pen-test / security review before major releases (`/security-review`).
