---
---

Every string in the web app is externalised, in English and Hindi (S9-18, NFR-016). Process and
copy only — no behaviour change.

909 keys per catalogue, identical key sets, enforced by `tsc` rather than by review: `const hi:
Messages` will not compile with a key missing. No `toLocaleDateString('en-GB')` survives anywhere;
dates, times and numbers follow the reader through `lib/i18n/format.ts`.

**NFR-016 stays ◐, and now for exactly one reason:** nobody who teaches in Hindi has read `hi.ts`.
The engineering half is done.
