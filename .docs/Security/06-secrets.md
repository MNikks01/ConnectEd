# Security — Secrets

`Status: Accepted` · `Last updated: 2026-08-08`

Every secret the product needs, what it protects, where it comes from, and what happens when one
leaks. Written for S9-6, because until this sprint **nothing in this repository had ever needed a
real secret** — every value in it is a development constant or a compose default, and a system that
has never held a secret has never had to be careful with one.

## The inventory

| Variable                          |    Required    | Protects                                                 | Blast radius if it leaks                                                 |
| --------------------------------- | :------------: | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`                    |       ✅       | Everything. Contains the database password               | Total: every account, mark, register and report card                     |
| `JWT_PRIVATE_KEY`                 | deployed only¹ | Signs access tokens (Ed25519, ADR-0014)                  | **Impersonation of anyone, silently.** The worst one here                |
| `JWT_ACCESS_SECRET`               |       ✅       | Signs access tokens under HS256, when no key pair is set | Same as above, wherever it is the active mechanism                       |
| `TWO_FACTOR_KEY`                  |    optional    | Encrypts TOTP secrets at rest (FR-AUTH-012)              | Second factors become forgeable; 2FA stops being a second factor         |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` |       ✅       | Object storage — every uploaded document and photograph  | Read and write of all media                                              |
| `REDIS_URL`                       |       ✅       | Queue and cache; may contain a password                  | Job injection and inspection; the outbox relay's destination             |
| `GITHUB_TOKEN`                    |    CI only     | Tags releases, pushes images to ghcr.io                  | Scoped per run and expires with it; cannot be exfiltrated to a later job |

¹ `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` are optional in the schema, and their absence falls back to
HS256 — which is what makes a local run need no key management. **In a deployed environment their
absence is a defect, not a default.** The public half is published at `/.well-known/jwks.json`; no
verifier ever needs the private one.

**Not secrets, despite looking like it:** `JWT_KEY_ID`, `JWT_PREVIOUS_KEY_ID`, `S3_ENDPOINT`,
`S3_BUCKET`, `WEB_ORIGIN`, every `OTEL_*`. They are configuration and belong in plain environment.

## Where each comes from

| Environment        | Mechanism                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local (`pnpm dev`) | `.env`, copied from `.env.example`, which ships working defaults for every required value                                                                                              |
| Local (compose)    | Literals in `infrastructure/docker/compose.yml`, labelled there as placeholders                                                                                                        |
| CI                 | Constants in the workflow files. **The E2E and test secrets are public on purpose** — they are in a public repository and guard a database that is created and dropped in the same job |
| Deployed           | ⏳ A secrets manager, chosen with S9-0a. Nothing exists yet                                                                                                                            |

**The values in this repository are not secrets and must never become them.** A test constant that
also works in staging is how a repository stops being able to tell the two apart. When S9-0a lands,
deployed values are generated fresh and never copied from here.

## Rules

- **Never in the repository**, in any form, including a `.env` that is gitignored today — one
  `git add -f` and it is permanent. The scanner below is the backstop, not the rule.
- **Never in an image.** `infrastructure/docker/*` builds nothing that carries a credential; values
  arrive as environment at run time. An image layer is not deletable.
- **Never logged.** `shared/logger` redacts; the standing rule in `apps/api/CLAUDE.md` is that
  passwords, tokens and secrets are never written, not even at debug.
- **Rotation is a routine, not an incident.** `Runbooks/jwt-key-rotation.md` covers the signing key
  on a 90-day cadence, and the schema supports an overlap window (`JWT_PREVIOUS_PUBLIC_KEY`) so a
  rotation costs nobody their session.

## The scanner

`.gitleaks.toml`, run by the `secret-scan` CI job on every pull request, over the **whole history**
rather than the diff. A secret that entered three months ago is live today, and a diff-only scan
would call the branch clean.

Measured 2026-08-08: **143 commits, no findings.** One false positive was ruled out rather than
silenced — `.env.example` shows the shape of a signing key, whose body is three literal dots. The
allowlist matches that placeholder, **not the file**: exempting `.env.example` wholesale would mean
a real key pasted into the very file people copy is the one thing the scanner cannot see.

Sabotage-checked by writing a genuine Ed25519 key into that same file, which is caught.

## What is still missing

- **A secrets manager**, and everything that follows from having one: least-privilege access, an
  audit trail of who read what, and rotation that is not a person editing an environment. S9-0a.
- **Rotation for anything other than the signing key.** The database password, the S3 pair and
  `TWO_FACTOR_KEY` have no documented rotation, because rotating them means coordinating with a
  running system and there is not one yet. `TWO_FACTOR_KEY` is the awkward one: it encrypts data at
  rest, so rotating it is a re-encryption, not a swap.
