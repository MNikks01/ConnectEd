# Database — RBAC Data Model

`Status: Accepted` · `Last updated: 2026-07-31`

How the [permission matrix](../PRD/09-permissions-matrix.md) is represented in data and evaluated. Authorization
logic lives in services (`Security/02-authorization.md`); this doc is the **data** those checks read.

## The three authorization inputs

Every authorization decision is a function of:

1. **Actor identity/role** — `account.type` + `user_profile.role`.
2. **Verification/membership** — `membership` rows with `status = VERIFIED` scoping the actor to a
   `(school, role, class?, child?)`.
3. **Resource ownership/scope** — FK relationships (author of a post, teacher allocated to a subject, class
   teacher of a class, parent of a child).

## Representative queries (conceptual)

**Can this account read a class's academics?**

```sql
-- verified membership in that class (student), or verified parent of a child in that class,
-- or teacher allocated to a subject in that class, or principal of the school, or the school itself
SELECT 1 FROM membership m
WHERE m.account_id = :actor AND m.status = 'VERIFIED'
  AND m.class_id = :classId
LIMIT 1;
```

**Can this teacher publish to a subject?**

```sql
SELECT 1
FROM subject_allocation sa
JOIN membership m ON m.account_id = :teacherAccount AND m.status='VERIFIED' AND m.role='TEACHER'
WHERE sa.teacher_id = :teacherId AND sa.subject_id = :subjectId
LIMIT 1;
```

**Can this teacher approve a leave application?**

```sql
SELECT 1 FROM class_teacher ct
WHERE ct.teacher_id = :teacherId AND ct.class_id = :leaveClassId
LIMIT 1;   -- teacher leave instead checks principal role of the school
```

## Integrity guards that back RBAC

- `class_teacher.class_id UNIQUE` → at most one class teacher per class.
- `membership` UNIQUE(`account_id,school_id,role,scope_key`) → no duplicate/ambiguous scopes. `scope_key` is a
  non-null derivation of (`class_id`, `child_id`); putting those nullable columns in the constraint directly
  would **not** work, because Postgres treats NULLs as distinct and school-wide roles (principal, teacher) leave
  both NULL. See `Database/01-schema.md`.
- `subject_allocation` UNIQUE(`teacher_id,subject_id`) → clean allocation.
- FKs ensure a leave/academic item always ties to a real class/school.

## Auditing authorization-relevant changes

`audit_log` records: verification decisions, membership revocations, class-teacher allocation, leave decisions,
role changes, and subscription changes — actor, action, entity, before/after in `metadata`.

## Defense in depth

- Service-layer checks are primary (`ADR-0006`).
- DB constraints prevent illegal states even if a bug slips a check.
- (Future) Postgres RLS may be layered as a backstop — deferred; would get its own ADR.
