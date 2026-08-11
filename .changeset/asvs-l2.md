---
---

OWASP ASVS 4.0.3 Level 2 walked as a checklist (NFR-005, `Security/07-asvs-l2.md`). Five findings,
four fixed here.

**A platform admin could not enrol in two-factor authentication** (V4.3.1). Eligibility read
`accountType === 'SCHOOL' || role === 'PRINCIPAL'`, and `isPlatformAdmin` is neither — it is a
column, independent of both. The people holding the moderation queue, the most privileged surface
in the product, could not turn on a second factor at all.

Also: `Cache-Control: no-store` on every authorized API response (V8.1.1 — helmet stopped setting
cache headers at v4, so children's data went out with no directives and heuristic freshness
deciding); `Strict-Transport-Security` on the web app (V14.4.5 — absent entirely); and a `pnpm
audit` gate in CI (V14.2.1), **which failed on its first run** and found a high-severity advisory in
the production tree that nothing would otherwise have reported.

The fifth — checking passwords against known breaches (V2.1.7) — is recorded as B-14 rather than
implemented, because it puts a third party in the authentication path of a children's product and
that is a decision rather than a task.
