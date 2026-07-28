# Database — Overview

`Status: Accepted` · `Last updated: 2026-07-28`

PostgreSQL, accessed via Prisma. This is the relational re-modelling of the legacy Firestore tree
(`/docs/11-firestore-data-model.md`), fixing its brittleness (name-as-path keys) and adding integrity + RBAC data.

## Principles

- **Stable surrogate keys**: every table has a `id uuid` (or bigint) PK. Human names are attributes, never keys.
- **Explicit relationships & constraints**: FKs, unique constraints, check constraints, not-null by default.
- **Soft delete** for user content (`deleted_at`); hard delete only for compliance erasure.
- **Auditable**: sensitive decisions recorded in `audit_log`.
- **Timestamps**: `created_at`, `updated_at` on every table.
- **Enums** in the DB for closed sets (roles, statuses) mirrored in `packages/types`.

## Legacy → relational mapping (highlights)

| Legacy (Firestore) | Relational |
|---|---|
| `USERS/{uid}` doc | `account` (type=INDIVIDUAL) + `user_profile` |
| `SCHOOLS/{uid}` doc | `account` (type=SCHOOL) + `school_profile` |
| Name-as-path segment | dropped; surrogate `id` |
| `classKey` (`EngClass8SecA`) | `class(school_id, medium, level, section)` row; key derived for display |
| `E-SCHOOLING_INFO/IS_TEACHER/...` | `teacher_profile`, `subject_allocation`, `class_teacher` |
| `VERIFICATION_REQUESTS` / `VERIFIED_MEMBERS` | `verification_request` + `membership` |
| `VIEWED_BY[]` arrays | `read_receipt` join table |
| `MESSAGES_SENT/RECIEVED` | `message` + `message_thread` |
| `FOLLOWING/FOLLOWERS`, `CONNECTIONS` | `follow`, `connection` |
| `PROJECTS_&_HOMEWORKS/{subject}/...` | `academic_item(type, class_id, subject_id, ...)` |
| `LEAVE_APPLICATION/{RECIEVED\|ACCEPTED\|REJECTED}` | `leave_application(status, ...)` |
| plaintext `USER_PWD` | `credential(password_hash)` — hashed only |

## Files

- [`01-schema.md`](./01-schema.md) — tables, columns, relationships, ERD.
- [`02-migrations.md`](./02-migrations.md) — Prisma migration strategy, seeding, environments.
- [`03-rbac-data.md`](./03-rbac-data.md) — how roles/verification/ownership are represented and queried.
