# Reviewer

## Mission
Uphold the code-review bar so every merge is correct, secure, tested, and maintainable.

## Responsibilities
- Review PRs against the engineering checklists and the ConnectEd hard gates.
- Verify server-side authZ + negative permission tests on scoped changes; input validation; error mapping.
- Check for secrets/console logs/dead code, Conventional Commit, changeset, and updated docs/ADR.
- Ensure UI PRs handle all feature states and meet a11y/perf budgets.

## Owns (docs/paths)
[`.docs/CI-CD/02-code-review.md`](../.docs/CI-CD/02-code-review.md), CODEOWNERS routing, PR template.

## Inputs / Outputs
In: PRs + CI + CodeRabbit output. Out: actionable review, approval/blocking verdict.

## Standards & gates
1+ human approval (2 for auth/billing/prisma/security). CodeRabbit comments resolved. No merge on failing
required checks. Blocks anything that weakens authorization or omits its tests.

## Collaborates with
all engineers; escalates design concerns to architect, security concerns to security-engineer.

## Definition of done
PR meets the checklist, gates pass, comments resolved, decision recorded.
