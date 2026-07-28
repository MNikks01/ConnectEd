# PRD — Overview

`Status: Accepted` · `Last updated: 2026-07-28`

This PRD defines **what** ConnectEd must do. The **how** lives in [`../TRD/`](../TRD/),
[`../Architecture/`](../Architecture/) and [`../API/`](../API/). Product context is in
[`../Product/`](../Product/).

## Requirement ID scheme

- Functional: `FR-<MODULE>-NNN` (e.g. `FR-AUTH-001`).
- Non-functional: `NFR-NNN` (in TRD).
- Every FR has: **Actor(s)**, **Priority** (P0 must / P1 should / P2 could), **Acceptance criteria**.

## Modules

| Module | File | Summary |
|---|---|---|
| Accounts & Auth | [`01-auth.md`](./01-auth.md) | Registration, login, sessions, account types, roles. |
| Institution & Classes | [`02-institution.md`](./02-institution.md) | School profile, classes, subjects, class-teacher allocation. |
| Verification | [`03-verification.md`](./03-verification.md) | Member role verification workflow. |
| Academics | [`04-academics.md`](./04-academics.md) | Homework/assignments/projects, notices, events, timetable, syllabus. |
| Workflows | [`05-workflows.md`](./05-workflows.md) | Leave applications, complaints & suggestions. |
| Social | [`06-social.md`](./06-social.md) | Profiles, posts, follow, connections, messaging. |
| Notifications | [`07-notifications.md`](./07-notifications.md) | In-app + push notification delivery. |
| Billing & Entitlements | [`08-billing.md`](./08-billing.md) | School subscriptions, plans, entitlements. |
| Permissions Matrix | [`09-permissions-matrix.md`](./09-permissions-matrix.md) | Consolidated who-can-do-what (server-enforced). |

## Cross-cutting product rules (apply to all modules)

1. **Server-enforced authorization.** Every request is authorized on the server against the actor's role,
   verification state, and resource ownership. The client never gates access on its own. (Reverses the legacy
   no-rules model — see `ADR-0006`.)
2. **Verification gates academics.** No academic read/write is permitted for a role until the relevant
   `VERIFIED_*` state is true for that member+class.
3. **Schools are web-only.** Institution accounts cannot authenticate from the mobile client.
4. **Read-tracking is first-class.** Academic items and notices record per-member read state.
5. **Auditability.** Verification decisions, leave decisions, and destructive admin actions are audit-logged.
6. **Soft delete + retention.** User-generated content is soft-deleted; retention per
   [`../Security/`](../Security/) data governance.

## Out of scope for v1

Gradebook/report cards, parent fee payments, live video, native mobile (see roadmap), advertising.
