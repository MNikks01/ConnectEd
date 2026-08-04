---
---

Two changes aimed at the long-standing local test flake (S5-12): a 401 now records _why_ a token
was refused, in the logs and never in the response; and the integration suite refuses to start
when another test run is already on its database. `@connected/api` is private, so no version bump.
