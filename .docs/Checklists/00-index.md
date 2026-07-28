# Engineering Checklists

`Status: Accepted` · `Last updated: 2026-07-28`

These are the **quality gates** for ConnectEd. They are referenced by the PR review process
([`../CI-CD/02-code-review.md`](../CI-CD/02-code-review.md)) and the Definition of Done.

- [`frontend-checklist.md`](./frontend-checklist.md) — Frontend Engineer → Architect master checklist.
- [`backend-checklist.md`](./backend-checklist.md) — Backend Engineer → Architect master checklist.

## How to use

- **Per feature:** run the relevant "Gold Standard / Feature Review" section before opening the PR.
- **Per PR:** reviewers confirm the applicable items; CI automates what it can (lint, types, tests, build,
  Lighthouse/a11y, audits).
- **ConnectEd-specific hard gates** (in addition to the generic checklists):
  - New scoped endpoint ⇒ **positive + negative permission tests** against
    [`../PRD/09-permissions-matrix.md`](../PRD/09-permissions-matrix.md).
  - No plaintext secrets/passwords; authZ enforced server-side.
  - Every UI feature ships Loading/Error/Empty/Success/Responsive/Accessible states.
  - Significant decision ⇒ an **ADR**.
