---
---

Orphaned upload collection (S3-12): every upload is recorded, modules claim the keys they attach, and a nightly
sweep deletes what nothing ever referenced. Adds the `media_object` table and a migration.
`@connected/api` is deployed rather than published, so no version bump.
