---
'@connected/types': patch
---

`/me` now reports whether the caller is ConnectEd staff, so the web app knows whether to offer the
moderation console. Navigation only — every moderation endpoint re-reads the row itself (S6-6,
ADR-0017).
