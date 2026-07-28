# 12 — Permissions & Roles

> **Important caveat:** No Firestore/Storage **security rules** exist in either repository. The permissions below describe the **intended** access model, enforced only by **client-side UI gating and query construction**. The backend does not technically prevent a determined client from reading/writing outside these bounds. This is flagged as a critical gap in [Missing Features](./16-missing-features.md).

## 12.1 Roles

| Role | Identifier | Platform | Scope |
|---|---|---|---|
| Student | `USER_CURRENT_STATUS = STUDENT` | M/W | One class of one school |
| Parent | `= PARENT` | M/W | One or more children, each in a class |
| Teacher | `= TEACHER` | M/W | Subjects + optional class-teacher role |
| Principal | `= PRINCIPAL` | M/W | Whole school |
| General User | empty/undefined | M/W | Social only |
| School | `SCHOOLS` collection | **W only** | Owns all academic + admin data |

## 12.2 Verification states gate access

- A member self-declares a role → `VERIFIED_* = false` → **no class academic access**.
- After school approval → `VERIFIED_* = true` → **class academic access granted**.
- The app checks `VERIFIED_TEACHER` / `VERIFIED_STUDENT` / `VERIFIED_PRINCIPAL` (and parent-child verification) before subscribing to class data.

## 12.3 Capability matrix

Legend: ✅ can do · 👁 view only · ➖ not available/hidden

| Capability | Student | Parent | Teacher | Class Teacher | Principal | School | General User |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Social: post/like/comment/follow/message | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View feed / profiles | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Declare e-schooling status | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| Submit verification request | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| Approve verification requests | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ |
| Publish homework/assignments/projects | ➖ | ➖ | ✅ | ✅ | 👁 | ✅ | ➖ |
| View homework | 👁 | 👁 | ✅ | ✅ | 👁 | 👁 | ➖ |
| Publish notices | ➖ | ➖ | ➖ | ➖ | ✅ | ✅ | ➖ |
| View notices | 👁 | 👁 | 👁 | 👁 | 👁 | ✅ | ➖ |
| Upload timetable | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ |
| View timetable | 👁 | 👁 | 👁 | 👁 | 👁 | ✅ | ➖ |
| Update syllabus coverage | ➖ | ➖ | ✅ | ✅ | 👁 | ✅ | ➖ |
| Submit leave application | ➖ | ✅ (for child) | ✅ | ✅ | ➖ | ➖ | ➖ |
| Approve student/parent leave | ➖ | ➖ | ➖ | ✅ | ➖ | 👁 | ➖ |
| Approve teacher leave | ➖ | ➖ | ➖ | ➖ | ✅ | 👁 | ➖ |
| Submit complaints/suggestions | ➖ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| Review complaints | ➖ | ➖ | 👁 | 👁 | ✅ | ✅ | ➖ |
| Create events | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ |
| Create school & class structure | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ |
| Verified members / add-remove / allocate class teacher | ➖ | ➖ | ➖ | ➖ | ➖ | ✅ | ➖ |

> Notes: Students explicitly have the **Leave** and **Complaints** modules **hidden** in the mobile drawer. General Users see only social + discovery. Principals generally have **view** access to academic content plus **teacher-leave approval**; whether principals can publish homework is **inferred** as no (that is a teacher/school action) — this could not be fully proven and is an **Assumption**.

## 12.4 Ownership rules (intended)

- A user can edit only **their own** profile and social content.
- A school can manage only **its own** class structure, members, and academic content.
- A teacher can publish only to subjects/classes they are **verified and allocated** to.
- A class teacher can approve leave only for **their allocated class**.
- A parent acts only within the scope of a **verified child**.
