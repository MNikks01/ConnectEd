---
---

A durable business-event log, so the metric tree can be measured (S9-15, `Product/02-metrics.md`).
No product behaviour change.

**Building it found that the north-star metric could not be computed.** _Weekly Active Verified
Members per school_ has been the declared north star since Sprint 2, and nothing in the schema
recorded that a member had done anything — the only `lastSeenAt` belonged to a push token and meant
"this device registered". Six of the eleven metric-tree rows had the same problem: they have time in
them, and an operational table knows its present state and has forgotten how it got there.

`product_event` is append-only and deliberately separate from the outbox, which has the opposite
lifetime — an outbox row exists to be delivered and is swept once it has been. It holds counts and
ids and **never text a person typed**, because a row here outlives the thing it describes.

Activity is stamped where a session is issued and deduped to one row per account per UTC day; without
that an active user writes ninety-six rows a day and every figure is inflated a hundredfold. It is
severed rather than deleted on erasure — deleting would retroactively lower every weekly-active
figure a school had ever been shown.

The analytics **sink** is not built and cannot be until B-1 gives it a destination. The table is the
half that cannot be backfilled.
