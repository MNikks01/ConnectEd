---
---

Fix the merge gate. Process only — no product change.

A cancelled post-merge run reports as _absent_ rather than as failed, and `ci.yml` cancelled every
in-progress run on every ref. Two pull requests merging seventeen seconds apart on 2026-08-09
therefore left `development` red with nothing saying so, and the next release inherited a defect.

`cancel-in-progress` is now true only for `pull_request` events: superseding a proposal's run is
right, superseding the record of whether a merge was good is not. Branch protection also gains
`strict: true` on both branches, and `secret-scan`, `restore-drill` and `images` become required
checks rather than checks that ran and were never gated on.
