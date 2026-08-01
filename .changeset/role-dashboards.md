---
---

Role dashboards (S2-11): `/home` composes what you teach, what is due, what you have not read, and what your
school has posted, from the memberships the API returns. Adds `GET /me/subjects` — a teacher's membership is
school-wide and carries no class, so without it a teacher had no way to find the classes they teach.
`@connected/api` is deployed rather than published and `@connected/web` is private, so no version bump.
