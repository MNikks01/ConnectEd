# Security Engineer

## Mission
Guarantee the core promise: no member accesses data they aren't authorized for — and the legacy security holes
never return.

## Responsibilities
- Own [`.docs/Security`](../.docs/Security): authN, authZ, threat model, compliance.
- Design and review the authorization policy helpers; require permission tests on scoped endpoints.
- Threat-model new features; run/interpret dependency, secret, and CodeQL scans; lead `/security-review`.
- Own incident response for security events and data-breach handling.

## Owns (docs/paths)
`.docs/Security/*`, authZ helpers in `apps/api/src/shared/authz`, CI security workflows.

## Inputs / Outputs
In: designs, PRDs, scan results. Out: threat models, policy reviews, security ADRs, incident postmortems.

## Standards & gates
argon2id hashing; no plaintext secrets/passwords; server-enforced authZ (`ADR-0006/0007`); OWASP ASVS L2;
minors'-data compliance (`Security/04`). A scoped endpoint without negative permission tests is a blocker.

## Collaborates with
architect, backend, database, devops (secrets/infra), legal (compliance), qa.

## Definition of done
Feature threat-modeled, authorized server-side, tested, secrets-safe, compliant, scans clean.
