# Security — Threat Model

`Status: Accepted` · `Last updated: 2026-07-28`

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

| Threat | Example | Mitigation |
|---|---|---|
| **Spoofing** | Forged identity / stolen token | Strong auth, short-lived JWT, refresh rotation + reuse detection, TLS. |
| **Tampering** | Client alters role/verification to read a class | Server-side authZ (`ADR-0006`); never trust client claims for scoped data; DB constraints. |
| **Repudiation** | Deny approving/removing a member | `audit_log` with actor + timestamp on all sensitive actions. |
| **Information disclosure** | Enumerate resources; leak PII/stack traces | 404-for-out-of-scope; scoped queries; no internals in errors; PII minimization; signed URLs for media. |
| **Denial of service** | Auth brute force, spam, hot endpoints | Rate limiting, lockout/backoff, pagination caps, queue-based fan-out, WAF/CDN in prod. |
| **Elevation of privilege** | Student acts as teacher/school | Least-privilege policies + verification checks + permission test matrix. |

## Abuse cases specific to ConnectEd

- **Fake verification requests** → schools approve manually; rate-limit re-applications; audit repeated rejects.
- **Cross-class snooping** → membership scoping on every academic read; negative permission tests.
- **Parent accessing a non-child** → `assertParentOfVerifiedChild`.
- **Teacher publishing outside allocation** → `assertTeacherAllocatedToSubject`.
- **Minor safety** → social features moderated (report/block); content soft-deleted for review.

## Practices

- Threat-model new features (security-engineer agent reviews design docs).
- Dependency & container scanning in CI; secret scanning (already on for the GitHub repo).
- Pen-test / security review before major releases (`/security-review`).
