# ADR-0001 — PostgreSQL as primary datastore

Status: Accepted
Date: 2026-07-28

## Context

The legacy app used Firestore: schema-less, deeply nested subcollections keyed by human-readable names (brittle
renames), no relational integrity, no server-side rules, and client-side fan-out with no transactions. The
rebuild needs relational integrity (schools→classes→subjects→memberships), transactional multi-writes
(verification, leave decisions), and server-enforced access — none of which Firestore served well here. The user
also specified Postgres.

## Decision

Use **PostgreSQL** as the single primary datastore for all relational/transactional data.

## Consequences

- **Positive:** strong relational integrity, transactions, mature tooling, rich querying, stable numeric/UUID
  keys (fixes legacy name-as-key brittleness), easy RBAC enforcement in SQL/service layer.
- **Negative:** we own schema migrations and scaling (read replicas, partitioning later). Real-time "live
  listeners" (a Firestore freebie) must be rebuilt (polling → websockets; see `ADR-0008`).
- **Follow-ups:** ORM choice (`ADR-0005`), migration strategy (`Database/`), backup/PITR (`Deployment/`).

## Alternatives

- **Stay on Firestore** — rejected: cannot server-enforce authZ cleanly, poor relational fit, the core problems
  being fixed originate here.
- **MySQL** — viable, but Postgres's JSONB, richer types, and constraints better fit mixed relational+document
  needs.
- **MongoDB** — rejected: repeats the schema-less pitfalls without the relational integrity we need.
