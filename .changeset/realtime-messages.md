---
---

Real-time message delivery over WebSocket (S5-11, FR-SOC-022, ADR-0016): a single-use ticket
authorizes the upgrade, Redis pub/sub carries delivery across replicas, and the frame says only
that a thread moved — the client re-reads through the API, which authorizes it. Both packages are
private, so no version bump.
