# <type>: <summary>

## What & why

<!-- What does this change do and which requirement/issue does it address? Link FR-/NFR-/ADR. -->

## How

<!-- Approach, notable decisions. If a significant decision, link the ADR. -->

## Test plan

<!-- How was this verified? -->

- [ ] Unit / integration tests added or updated
- [ ] **Scoped endpoint? Positive AND negative permission tests added** (matrix: .docs/PRD/09-permissions-matrix.md)
- [ ] E2E updated if a critical flow changed

## Checklist

- [ ] Branch off `development`; PR targets `development` (or hotfix → `main`)
- [ ] Conventional Commit title
- [ ] Changeset added (if shippable package changed) — `pnpm changeset`
- [ ] Server-side authorization enforced for scoped changes
- [ ] Input validated (zod); errors use the standard envelope
- [ ] No secrets / console logs / dead code; no plaintext passwords/PII
- [ ] UI: Loading/Error/Empty/Success/Responsive/Accessible states handled
- [ ] Docs/ADRs updated; relevant `.docs/Checklists` satisfied

## Screenshots / notes

<!-- optional -->
