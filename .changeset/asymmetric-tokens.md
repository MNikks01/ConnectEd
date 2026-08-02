---
---

Ed25519 access tokens with a published JWKS (S3-10, ADR-0014). HS256 stays the default for local development;
production supplies a key pair and gets `kid`-based rotation with an overlap window. `@connected/api` is
deployed rather than published, so no version bump.
