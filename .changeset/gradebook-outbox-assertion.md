---
---

Fix a gradebook test that failed on a correct payload. Test-only.

`expect(JSON.stringify(payload)).not.toContain('17.5')` matched the _timestamp_: an `occurredAt` of
`…T07:13:17.571Z` contains `17.5`. It failed a CI run on 2026-08-12 against an unchanged payload and
would have done it roughly once in six hundred runs, including on a release.

Replaced with an assertion on the payload's key set, which also closes the gap the old one had:
a payload carrying `grade: 'B+'` — the same result, in the form a parent reads — passed it.
