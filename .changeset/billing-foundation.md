---
'@connected/types': minor
---

Billing DTOs: `SubscriptionResponse`, plan limits and features, and usage measured against them.

The API side (S5-1, S5-2) is a plan catalogue, entitlement resolution, and a trial created in the
same statement as the school — `@connected/api` is private and ignored by changesets, so only the
shared types carry a version bump.
