---
---

Class feed, item view, and notification bell in the web app (S2-7, S2-8), plus `GET /me/memberships` — until
now a verified student had no way to find their own class. `@connected/api` is deployed rather than published
and `@connected/web` is private, so no version bump.

Also fixes an authorization defect the browser tests exposed: `assertTeacherAllocatedToSubject` and
`assertPrincipalOfSchool` gated on the access token's role claim, which registration always sets to `USER` and
verification never changes. Both now read the verified membership alone, as the permission matrix specifies.
