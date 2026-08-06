---
---

Adds the transactional outbox (S7-1, ADR-0019): a domain event is written in the same transaction as the change that produced it, and a relay hands it to the queue. `@connected/api` is private, so nothing is published.
