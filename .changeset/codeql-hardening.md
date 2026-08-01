---
---

Clears the CodeQL alerts on `development`: a read-only `GITHUB_TOKEN` for CI, `SameSite=Strict` on the refresh
cookie, and the CSRF analysis recorded in the threat model. `@connected/api` is deployed rather than published,
so no version bump.
