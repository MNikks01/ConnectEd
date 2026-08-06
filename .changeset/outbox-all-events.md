---
---

Moves the remaining seven domain events onto the outbox (S7-2, ADR-0019) and deletes the publisher that dropped an event when Redis was unreachable. `@connected/api` is private, so nothing is published.
