---
'@connected/types': patch
---

`/me` now reports whether a confirmed second factor is in place, so the settings page can render
the right state (FR-AUTH-012). For rendering, not for trust — every 2FA endpoint re-reads it.
