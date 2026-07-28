# Security — Authorization

`Status: Accepted` · `Last updated: 2026-07-28`

Implements `ADR-0006`. This is the enforcement contract for the
[permission matrix](../PRD/09-permissions-matrix.md).

## Model

Authorization = **policy(actor, action, resource, context)** evaluated in the **service layer**, using data from
`03-rbac-data.md`. Three inputs: role/account-type, verified membership, resource ownership/scope.

## Layered enforcement

1. **Middleware** — authenticate (valid token → load actor), attach `req.actor`, apply coarse rate limits.
2. **Route guards** — declarative required-role/account-type for the endpoint (cheap early reject).
3. **Service policies** — the authoritative check: fine-grained, data-aware (verification + ownership). A handler
   **must** call the relevant policy before mutating/reading scoped data.
4. **DB constraints** — prevent illegal states even on a missed check (`03-rbac-data.md`).
5. **Client guards** — mirror the matrix for UX only; never trusted.

## Policy helpers (illustrative interface)

```ts
// packages/types + apps/api/src/shared/authz
requireRole(actor, [UserRole.TEACHER])
requireAccountType(actor, AccountType.SCHOOL)
assertVerifiedMemberOfClass(actor, classId)          // student/parent/teacher/principal paths
assertTeacherAllocatedToSubject(actor, subjectId)
assertClassTeacherOf(actor, classId)                 // leave approval (student/parent)
assertPrincipalOfSchool(actor, schoolId)             // teacher-leave approval
assertOwnsResource(actor, resource)                  // author-only edit/delete
assertParentOfVerifiedChild(actor, childId)
```

Each throws a typed `ForbiddenError`/`VerificationRequiredError` (→ 403) or `NotFoundError` (→ 404 for
out-of-scope reads, to avoid existence leaks).

## Testing the matrix

- Every scoped endpoint has **positive and negative** permission integration tests: for each role, assert allowed
  ⇒ 2xx and disallowed ⇒ 403/404.
- A **permission matrix test suite** iterates roles × capabilities and asserts against
  `PRD/09-permissions-matrix.md`. Adding an endpoint without matrix tests fails the checklist gate.

## Notable rules (from the matrix)

- No self-approval of verification; only the school approves.
- Teacher writes only to allocated subject+class; class teacher approves leave only for their class; principal
  approves only teacher leave.
- Parent acts only within a verified child's scope.
- Students: leave & complaints hidden (enforced server-side too, not just UI).
- School accounts: web-only.
