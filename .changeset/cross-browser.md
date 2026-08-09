---
---

The end-to-end suite now runs in Firefox and WebKit and at a 320px viewport (S9-17, NFR-011).

**Two product fixes came out of it.** Session cookies were marked `Secure` based on `NODE_ENV`
alone, which WebKit drops when the app is served over plain HTTP — every sign-in failed in Safari.
The flag is now an explicit `SESSION_COOKIE_SECURE`, defaulting to the previous behaviour. And a
class page overflowed a 320px screen by 69px, because a row of five links could not wrap.
