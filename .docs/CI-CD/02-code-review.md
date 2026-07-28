# CI/CD — Code Review (CodeRabbit + human)

`Status: Accepted` · `Last updated: 2026-07-28`

Two-layer review on every PR: **CodeRabbit** (AI) for breadth/speed, **human CODEOWNERS** for judgment and
domain correctness. AI review augments, never replaces, human approval.

## CodeRabbit

- Configured via `.coderabbit.yaml` at repo root.
- Reviews each PR: summary, file-level comments, potential bugs, security smells, style.
- Focus areas we ask it to weight: authorization checks present on new scoped endpoints, input validation,
  error handling, missing tests, secret leakage.
- Author must resolve or explicitly dismiss actionable comments before merge.

## Human review

- **CODEOWNERS** auto-requests the right reviewers by path (frontend, backend, db/`prisma`, security, infra).
- Reviewer checklist (from the engineering checklists):
  - Server-side authZ present & tested for scoped changes (permission matrix).
  - Input validated; errors mapped to the envelope; no internals leaked.
  - Tests: unit + integration; negative permission cases for new endpoints.
  - No secrets/console logs/dead code; Conventional Commit; changeset included.
  - Loading/Error/Empty/Success/Responsive/A11y states for UI.
- **1+ approval** required; sensitive paths (auth, billing, prisma, security docs) may require 2.

## Definition of Done for a PR

Passes CI (lint/format/type/test/build) · CodeRabbit addressed · human approval · changeset (if shippable) ·
docs updated (ADR if a significant decision) · matrix tests for new endpoints. See
[`../Checklists/`](../Checklists/).
