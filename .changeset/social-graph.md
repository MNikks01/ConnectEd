---
---

Follows and connections (S4-4, S4-5, FR-SOC-010/011), plus a fix for the intermittent API-suite failure: test
files shared a database while their worker processes overlapped. `@connected/api` is deployed rather than
published, so no version bump.
