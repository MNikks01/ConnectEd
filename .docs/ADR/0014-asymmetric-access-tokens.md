# ADR-0014 — Ed25519 access tokens with a published JWKS

Status: Accepted
Date: 2026-08-02

## Context

`ADR-0007` chose JWT access tokens with rotating opaque refresh tokens, and named asymmetric signing plus a
JWKS endpoint as the target without adopting it. The API has signed with **HS256** and a shared secret since
S0-5, and the gap has been carried in every sprint review since.

HS256 has two consequences that get worse as the system grows:

- **Verifying requires the signing key.** Anything that wants to check a token — a second service, a gateway,
  an analytics job — must hold the key that mints them. Today only the API verifies, so the exposure is
  theoretical; it stops being theoretical the first time something else needs to.
- **Rotation is a flag day.** With one secret and no key id, every verifier must change at the same instant as
  the signer, or tokens break. In practice that means nobody rotates.

## Decision

Sign access tokens with **Ed25519 (EdDSA)** when a key pair is configured, and publish the public half at
**`/.well-known/jwks.json`**.

- **Ed25519, not RSA.** 64-byte signatures against RSA-2048's 256 on a header sent with every request; no key
  size or padding to choose wrongly; and none of the RSA-specific confusion attacks. Required by FIPS 186-5 and
  present in every runtime this project targets.
- **`kid` in every token header**, matching the JWKS entry, so a verifier selects a key instead of trying all of
  them.
- **Rotation is an overlap, not a flag day.** `JWT_PREVIOUS_PUBLIC_KEY` keeps the outgoing key verifiable while
  tokens signed with it expire, and JWKS publishes both. Nothing new is ever signed with the previous key.
- **HS256 stays as the default for local development.** `JWT_ACCESS_SECRET` remains the only setting needed to
  run the API, so nobody has to generate keys to fix a typo. The two modes never mix: the algorithm is pinned to
  exactly one value at verification, and a token signed the other way is refused rather than falling back.
- **The JWKS route is absent, not empty, in symmetric mode.** An HS256 secret has no public half, and answering
  `{"keys":[]}` would read as "asymmetric, keys lost".

## Consequences

**Good.** A verifier can be added without being handed signing material. Rotation becomes a configuration change
with an overlap window instead of a coordinated outage. The key id makes "which key signed this" answerable from
the token itself.

**Cost.** Production now has key material to manage — generated, stored in the secret manager, and rotated on a
schedule. [`Runbooks/jwt-key-rotation.md`](../Runbooks/jwt-key-rotation.md) carries the procedure, including the
emergency variant that deliberately skips the overlap; the failure mode of _not_ writing it down is a rotation
nobody dares perform, which is where this started.

**Not solved here.** Nothing yet verifies tokens except the API, so the immediate benefit is rotation rather
than decoupling. Refresh tokens are unaffected — they are opaque strings by `ADR-0007` and have no signature to
verify.

## Alternatives considered

- **RS256.** Universally supported, and the signatures are four times larger on every request. Ed25519 is
  supported by every client this project will have.
- **Rotate the HS256 secret instead.** Solves nothing: still a flag day, still requires sharing the signing key
  to verify.
- **Fetch keys from a JWKS the API does not host** (an external IdP). A larger change than this sprint's
  stretch item, and it belongs to a decision about identity provisioning rather than token format.

## Generating a pair

```bash
openssl genpkey -algorithm ed25519 -out jwt-private.pem
openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
```

`JWT_PRIVATE_KEY` takes the PKCS#8 PEM, `JWT_PUBLIC_KEY` the SPKI PEM. Both or neither — the API refuses to
start with one and not the other.
