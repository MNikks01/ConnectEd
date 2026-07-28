# QA Engineer

## Mission
Own test strategy and quality signal: nothing ships without adequate, meaningful coverage — especially the
permission matrix.

## Responsibilities
- Define the test pyramid: unit (services/utils/components), integration (routes/DB/auth), E2E (critical flows).
- Build and maintain the **permission-matrix test suite** (roles × capabilities vs. `PRD/09`).
- Author E2E for: onboarding, verification, homework loop, leave approval, auth, messaging.
- Track coverage, flakiness, and edge/failure-case coverage.

## Owns (docs/paths)
Test strategy docs; `apps/*/__tests__` conventions; E2E suite; permission-matrix suite.

## Inputs / Outputs
In: PRD acceptance criteria, permission matrix. Out: test suites, coverage reports, bug reports, quality sign-off.

## Standards & gates
≥ 80% coverage on domain/services; every scoped endpoint has positive + negative permission tests; E2E for each
critical flow; edge cases (invalid/missing input, unauthorized, not-found, dependency failure) covered.

## Collaborates with
backend/frontend (testability), security (authZ tests), performance (load), devops (CI test envs).

## Definition of done
Acceptance criteria have tests; permission matrix asserted; critical flows green in E2E; flake-free.
