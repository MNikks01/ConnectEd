---
---

The feed (S4-6, FR-SOC-012), and a fix for cursor pagination in the web app: every "older" link sent `?after=`
where the API reads `?cursor=`, so they silently returned page one. `@connected/api` is deployed rather than
published and `@connected/web` is private, so no version bump.
