# Security — OWASP ASVS 4.0.3 Level 2, walked

`Status: Accepted` · `Last updated: 2026-08-11` · Walked at `development` after `release/2026-08-12`

NFR-005 has asked for ASVS L2 since Sprint 2. A [full security review](./05-review-2026-08-05.md)
was run on 2026-08-05 and found three real defects, but **the standard itself had never been walked
as a checklist**, and `PRD/10-completeness.md` has recorded that distinction as ◐ ever since. This
is the walk.

## Why a checklist finds things a review does not

The August review was a good review and it looked where an experienced reader looks: headers,
sessions, injection, authorization, secrets. A checklist is worse at that and better at something
else — **it asks about the things nobody thinks to look at**, because the standard asks about them
whether or not they seem interesting here.

Four of the five findings below are of that kind. None is exotic. Each is a requirement that reads
as obvious once stated and that no amount of reading the code from the inside would have prompted,
because nothing in the code is _wrong_ — the control is simply absent, and absence has no line
number.

**Five findings. Four are fixed in this pass; one is recorded and needs a product decision.**

## Findings

### 1. ConnectEd staff could not enrol in two-factor authentication — **high** · _fixed_

**V4.3.1** — _administrative interfaces use appropriate multi-factor authentication._

Eligibility read:

```ts
return actor.accountType === 'SCHOOL' || actor.role === 'PRINCIPAL';
```

`isPlatformAdmin` is neither. It is a **column on `account`**, deliberately independent of `type`
and `role` (ADR-0017), so a staff account is an ordinary individual with a flag set. The people
holding the moderation queue — the most privileged surface in the product, which reads reports
_about_ people at schools and whose decisions remove other people's content — **could not turn on a
second factor at all**, unless they happened also to be a school account or a principal.

The one interface the standard singles out for MFA was the only one that could not have it.

**Fixed.** Eligibility now includes `isPlatformAdmin`, read **from the database** rather than from
the actor, for the reason ADR-0017 gives: the integration suite signs its own tokens, and a claim is
only as trustworthy as the narrowest place that mints one. A test enrols a plain `USER` carrying no
special claim, and is sabotage-checked.

### 2. No `Cache-Control` on authorized API responses — **medium** · _fixed_

**V8.1.1** — _the application protects sensitive data from being cached in server components such
as load balancers and application caches._

Helmet has not set cache headers since v4, so every authorized JSON response — a register, a mark,
a child's report card — went out with **no cache directives at all**. What then decides whether a
shared cache keeps a copy is _heuristic freshness_: a guess made by a proxy nobody in this project
has configured, about data belonging to children.

Nothing was observed caching anything. There is also no deployment yet, so there is no proxy to
have observed — which is precisely why this is the kind of thing to fix before there is one.

**Fixed.** Everything under `/api/v1` sets `no-store`. Not `no-cache`, which permits storage and
merely requires revalidation — "stored but revalidated" is still a copy on a machine between us and
the reader. `/healthz` and `/readyz` are exempt (no personal data, polled hard) and JWKS keeps its
deliberate long `max-age`.

**The test proves the instruction is sent, not that intermediaries obey it.** There is no cache in
the suite to observe, and pretending otherwise would be the kind of claim this document exists to
avoid.

### 3. No `Strict-Transport-Security` header — **medium** · _fixed_

**V14.4.5** — _a Strict-Transport-Security header is included on all responses and for all
subdomains._

The web app sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Cross-Origin-Opener-Policy` and a nonce CSP — all added by finding #1 of the
August review — and **no HSTS**. The review that added the others did not add this one, and nothing
since has asked.

**Fixed**, and the timing is the whole point: browsers ignore HSTS over plain HTTP, so it costs
nothing locally and in the end-to-end suite, but it must already be **present on the first HTTPS
response a real user ever receives**. Adding it at deploy time means the one request that mattered
was unprotected.

`preload` is deliberately absent. Submitting to the preload list is close to irreversible and
commits every future subdomain to HTTPS; that belongs to whoever answers B-1 and buys the domain
(B-7.1), not to a header file.

### 4. Nothing re-checked dependencies for known vulnerabilities — **medium** · _fixed, and it found one_

**V14.2.1** — _all components are up to date, preferably using a dependency checker during build or
compile time._

The August review ran `pnpm audit` by hand and recorded "reports nothing, with and without dev
dependencies". That was true on the day, and **nothing re-checked it for six days.** A point-in-time
observation had been written down as though it were a property — which is the exact shape of thing a
checklist walk is for.

**Fixed:** an `audit` job on every pull request, `--prod --audit-level high`. Production only,
deliberately: a vulnerability in a dev dependency is worth knowing and is not worth blocking a merge
over, because it does not ship.

**It failed on its first run.** `nanoid@3.3.16`, reached through `next → postcss`, high severity
([GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8)). The real-world risk here
is slight — the loop needs a custom generator with `size: 0`, which postcss does not do — but the
finding is not the advisory. The finding is that **the repository had a high-severity advisory in
its production tree and no mechanism that would ever have said so.** Pinned via a pnpm override to
`^3.3.17`; the audit is clean and the web build is unaffected.

### 5. Passwords are not checked against known breaches — **medium** · _open, needs a decision_

**V2.1.7** — _verify that passwords submitted during account registration, login, and password
change are checked against a set of breached passwords._

The password policy is otherwise good and deliberately so (`Security/01-authentication.md`): 12
characters minimum, 256 maximum, **no composition rules**, argon2id at the OWASP floor (19 MiB,
t=2, p=1), and the reset flow reuses the registration schema so it cannot be the weak way in. What
is missing is the one check that catches the actual failure — a 14-character password that is
already in a wordlist.

**This is not fixed here, and the reason is that it is not an engineering decision.** The standard
implementation is Have I Been Pwned's range API, which means:

- sending the first five characters of a SHA-1 of the user's password to a third party on every
  registration, login and change — k-anonymity, and still a third party in the authentication path;
- a network call in the login path, needing a timeout and a decision about what happens when it is
  down (fail open, or lock everybody out);
- a data-processing record for a new sub-processor (`Security/04-compliance.md`), for a product
  handling children's data.

Each of those is a product call. The alternatives are a bundled top-100k wordlist (no third party,
weaker coverage, ~1 MB in the image) or accepting the gap.

**Recorded as [B-14](../Product/05-what-is-blocked-on-you.md) rather than implemented**, because
adding a third party to the authentication path of a children's product without asking would be the
wrong kind of initiative.

## What was checked and found sound

Not a certificate — a record of what was looked at, so the next walk starts from evidence rather
than from scratch. Chapters are ASVS 4.0.3.

| Chapter                        | Verdict | Evidence                                                                                                                                                                                                                             |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **V1** Architecture            | ✅      | Threat model (`03-threat-model.md`), 21 ADRs, documented trust boundaries, permission matrix as the authorization contract                                                                                                           |
| **V2** Authentication          | ◐       | argon2id at the OWASP floor; no composition rules; per-address exponential backoff **and** per-IP limiting; enumeration-safe (dummy hash, uniform errors); TOTP with encrypted secrets and single-use recovery codes. **Gap: 2.1.7** |
| **V3** Session management      | ✅      | 15-minute access tokens; rotating refresh with **reuse detection that revokes the family**; `httpOnly` + `SameSite=Strict` + path-scoped + `Secure` by config; logout and password reset revoke every session                        |
| **V4** Access control          | ✅      | Server-enforced on every scoped operation; policies **throw rather than return booleans**; 404 over 403 so existence cannot be probed; positive _and_ negative permission tests per endpoint. **Fixed: 4.3.1**                       |
| **V5** Validation & encoding   | ✅      | zod on every external input; Prisma parameterises; bodies rendered as text with `pre-wrap` rather than markup; CSP forbids `unsafe-inline`/`unsafe-eval` on scripts                                                                  |
| **V6** Stored cryptography     | ✅      | argon2id; AES-256-GCM for TOTP secrets with the key outside the table; Ed25519 access tokens with published JWKS; **rejection-sampled** randomness, no `Math.random` in production code                                              |
| **V7** Error handling, logging | ✅      | One global error mapper; correlation IDs; pino redaction list; append-only `audit_log`; failed logins log an outcome and **never the address**                                                                                       |
| **V8** Data protection         | ◐ → ✅  | Private bucket, short-lived signed URLs, subject export and erasure (ADR-0020). **Fixed: 8.1.1**                                                                                                                                     |
| **V9** Communications          | ⏳      | TLS is a deployment property and there is no deployment. HSTS now sent (#3); the rest is B-1                                                                                                                                         |
| **V10** Malicious code         | ✅      | CodeQL on every PR, gitleaks over the whole history, no `eval`, lockfile committed, `--frozen-lockfile` in CI                                                                                                                        |
| **V11** Business logic         | ✅      | Plan limits enforced server-side (`402`, not `403`); marks publish as one transaction; erasure has a grace period; register amendments are audited                                                                                   |
| **V12** Files and resources    | ✅      | Uploads validated by **magic bytes**, not the declared type; unguessable keys; private objects; size cap; orphan sweep                                                                                                               |
| **V13** API                    | ✅      | REST + JSON only; origin check on cookie-authenticated writes; CORS restricted; 1 MB body cap; no mass assignment (zod picks fields)                                                                                                 |
| **V14** Configuration          | ◐ → ✅  | Full header set, config validated at boot, `TRUST_PROXY` explicit, secrets inventory. **Fixed: 14.2.1, 14.4.5**                                                                                                                      |

## The limits of this document

**It is a walk, not an audit.** It was performed by the person who wrote most of the code, which is
the same weakness `Product/05-what-is-blocked-on-you.md` records as **B-8**: nothing in this
repository has been read by a second person in ten sprints. A checklist is a partial defence against
that — it asks its own questions rather than mine — and it is not a substitute.

**Level 3 was not attempted**, and L2 is the right target: L3 is for systems performing high-value
transactions or holding the most sensitive medical data, and it asks for things this product has no
means of doing yet (full audit trails of every read, memory-safe handling, HSM-backed keys).

**V9 cannot be finished from here.** TLS configuration, certificate management and cipher selection
are properties of a deployment, and there is no deployment. That is B-1, like the deployed half of
four NFRs.

**NFR-005 moves from ◐ to ✅** on the strength of this walk, with 2.1.7 carried as a recorded,
decided-against-for-now gap rather than an unknown. If that reads as generous, the honest alternative
is that the row stays ◐ forever, because a standard walked by one person is the best this project can
do until B-8 is answered.
