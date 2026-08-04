# Database — Schema & ERD

`Status: Accepted` · `Last updated: 2026-08-02`

Logical schema (Prisma models will mirror this). Types are indicative; all tables have `id`, `created_at`,
`updated_at`; user-content tables add `deleted_at`.

## Enums

- `AccountType`: `INDIVIDUAL | SCHOOL`
- `UserRole`: `STUDENT | PARENT | TEACHER | PRINCIPAL | USER`
- `Medium`: `ENGLISH | HINDI`
- `ClassLevel`: `PRE_NURSERY | NURSERY | KG1 | KG2 | CLASS_1 … CLASS_12`
- `Section`: `A | B | C | D | E`
- `VerificationStatus`: `PENDING | VERIFIED | REJECTED | REVOKED`
- `AcademicItemType`: `HOMEWORK | ASSIGNMENT | PROJECT`
- `LeaveStatus`: `RECEIVED | ACCEPTED | REJECTED`
- `LeaveKind`: `STUDENT | TEACHER`
- `FeedbackKind`: `COMPLAINT | SUGGESTION`
- `SubscriptionStatus`: `TRIALING | ACTIVE | PAST_DUE | CANCELED`

Added while implementing the schema, for columns the tables above list without naming a closed set:

- `AccountStatus`: `ACTIVE | SUSPENDED | DEACTIVATED` — `account.status`
- `FeedbackStatus`: `OPEN | UNDER_REVIEW | RESOLVED` — `feedback.status`
- `ProfileVisibility`: `PUBLIC | CONNECTIONS` — `user_profile.visibility`; the name-and-avatar card is always visible
- `ConnectionStatus`: `PENDING | ACCEPTED` — `connection.status`
- `ReadReceiptSubject`: `NOTICE | ACADEMIC_ITEM | EVENT | TIMETABLE` — `read_receipt.subject_type`
- `NotificationCategory`: `ACADEMIC | NOTICE | EVENT | LEAVE | SOCIAL | MESSAGE | VERIFICATION | BILLING` —
  `notification_pref.category`. Note `notification.type` stays a free-form string: types grow per module, so
  only the preference _category_ is a closed set.
- `DevicePlatform`: `IOS | ANDROID | WEB` — `push_token.platform`

## Identity & accounts

| Table            | Key columns                                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `account`        | `id`, `type (AccountType)`, `email UNIQUE`, `email_verified_at`, `status`                                                                                          |
| `credential`     | `account_id FK`, `password_hash`, `algo`, `updated_at`                                                                                                             |
| `refresh_token`  | `id`, `account_id FK`, `family_id`, `token_hash`, `expires_at`, `revoked_at`, `replaced_by`                                                                        |
| `user_profile`   | `account_id FK`, `full_name`, `handle UNIQUE`, `mobile`, `gender`, `dob`, `bio`, `display_pic_key`, `achievements`, `role (UserRole)`                              |
| `school_profile` | `account_id FK`, `name`, `admin_name`, `phone`, address fields, `about`, `mission`, `vision`, `facilities`, `establishment_year`, `affiliation`, `display_pic_key` |

## Institution & academics structure

| Table                | Key columns                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| `class`              | `id`, `school_id FK`, `medium`, `level`, `section`, `active`, UNIQUE(`school_id,medium,level,section`) |
| `subject`            | `id`, `class_id FK`, `name`, UNIQUE(`class_id,name`)                                                   |
| `teacher_profile`    | `id`, `account_id FK`, `school_id FK`                                                                  |
| `subject_allocation` | `teacher_id FK`, `subject_id FK`, UNIQUE(`teacher_id,subject_id`)                                      |
| `class_teacher`      | `class_id FK UNIQUE`, `teacher_id FK`, `allocated_at`                                                  |
| `child`              | `id`, `parent_account_id FK`, `full_name`, `school_id FK`, `class_id FK`                               |

## Membership & verification

| Table                  | Key columns                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `verification_request` | `id`, `requester_account_id FK`, `school_id FK`, `role (UserRole)`, `class_id FK?`, `child_id FK?`, `status`, `decided_by`, `decided_at`, `payload jsonb`                |
| `membership`           | `id`, `account_id FK`, `school_id FK`, `role`, `class_id FK?`, `child_id FK?`, `scope_key`, `status (VerificationStatus)`, UNIQUE(`account_id,school_id,role,scope_key`) |

> **Why `scope_key` instead of the nullable columns.** The original design put `class_id, child_id` directly in
> the unique constraint. Postgres treats NULLs as **distinct**, so that constraint would not have prevented
> duplicate `PRINCIPAL`/`TEACHER` memberships — the rows with no class or child, and the most authority.
> `scope_key` is a non-null derivation of the optional pair (`membershipScopeKey()` in
> `apps/api/src/shared/db`), which makes the constraint enforceable. Postgres 15+ could express this with
> `UNIQUE NULLS NOT DISTINCT`, but Prisma cannot emit it, and hand-written partial indexes would be reverted by
> the next `migrate dev`. See `ADR-0013` for the Prisma version context.

## Academic content

| Table               | Key columns                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `academic_item`     | `id`, `type (AcademicItemType)`, `class_id FK`, `subject_id FK`, `author_account_id FK`, `title`, `body`, `image_key?`, `due_at?`       |
| `notice`            | `id`, `school_id FK`, `author_account_id FK`, `title`, `body`                                                                           |
| `event`             | `id`, `school_id FK`, `title`, `body`, `event_at`                                                                                       |
| `timetable`         | `id`, `class_id FK`, `image_key`, `version`                                                                                             |
| `syllabus_progress` | `id`, `subject_id FK`, `topic`, `percent`, `updated_by`                                                                                 |
| `read_receipt`      | `id`, `subject_type (notice/academic_item/...)`, `subject_id`, `account_id FK`, `read_at`, UNIQUE(`subject_type,subject_id,account_id`) |

## Workflows

| Table               | Key columns                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leave_application` | `id`, `kind (LeaveKind)`, `applicant_account_id FK`, `child_id FK?`, `class_id FK?`, `school_id FK`, `start_date`, `end_date`, `reason`, `status (LeaveStatus)`, `decided_by`, `decided_at` |
| `media_object`      | `key PK`, `prefix`, `content_type`, `size_bytes`, `uploaded_by FK`, `claimed_at`, `created_at` — what was uploaded, and whether anything ever referenced it                                 |
| `feedback`          | `id`, `kind (FeedbackKind)`, `author_account_id FK`, `school_id FK`, `body`, `status`, `reviewed_by`, `reviewed_at`                                                                         |

## Social

| Table            | Key columns                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `post`           | `id`, `author_account_id FK`, `body`, `image_key?`                                                                                                            |
| `post_like`      | `post_id FK`, `account_id FK`, UNIQUE(`post_id,account_id`)                                                                                                   |
| `post_comment`   | `id`, `post_id FK`, `account_id FK`, `body`                                                                                                                   |
| `report`         | `id`, `reporter_account_id FK`, `subject_type`, `subject_id`, `reason`, `status`, `reviewed_by`, `reviewed_at` — **nothing reads this queue yet; see PRD 06** |
| `block`          | `id`, `blocker_account_id FK`, `blocked_account_id FK`, `created_at` — applied **both ways** on every social read                                             |
| `follow`         | `follower_account_id FK`, `followee_account_id FK`, UNIQUE(pair)                                                                                              |
| `connection`     | `a_account_id`, `b_account_id`, `status (pending/accepted)`, `requested_by`, UNIQUE(pair)                                                                     |
| `message_thread` | `id`, `participant_a`, `participant_b`                                                                                                                        |
| `message`        | `id`, `thread_id FK`, `sender_account_id FK`, `body`, `read_at?`                                                                                              |

## Notifications & billing

| Table               | Key columns                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| `notification`      | `id`, `recipient_account_id FK`, `type`, `payload jsonb`, `read_at?`, `event_id` (idempotency) |
| `notification_pref` | `account_id FK`, `category`, `enabled`                                                         |
| `push_token`        | `id`, `account_id FK`, `platform`, `token`, `last_seen_at`                                     |
| `plan`              | `id`, `code`, `name`, `limits jsonb`, `features jsonb`                                         |
| `subscription`      | `id`, `school_id FK`, `plan_id FK`, `status`, `period_start`, `period_end`, `provider_ref`     |
| `audit_log`         | `id`, `actor_account_id`, `action`, `entity`, `entity_id`, `metadata jsonb`, `created_at`      |

## ERD (core)

```mermaid
erDiagram
  ACCOUNT ||--o| USER_PROFILE : has
  ACCOUNT ||--o| SCHOOL_PROFILE : has
  ACCOUNT ||--|| CREDENTIAL : has
  SCHOOL_PROFILE ||--o{ CLASS : owns
  CLASS ||--o{ SUBJECT : offers
  CLASS ||--|| CLASS_TEACHER : allocated
  TEACHER_PROFILE ||--o{ SUBJECT_ALLOCATION : teaches
  ACCOUNT ||--o{ VERIFICATION_REQUEST : submits
  ACCOUNT ||--o{ MEMBERSHIP : has
  CLASS ||--o{ MEMBERSHIP : includes
  CLASS ||--o{ ACADEMIC_ITEM : contains
  SUBJECT ||--o{ ACADEMIC_ITEM : categorizes
  ACADEMIC_ITEM ||--o{ READ_RECEIPT : tracked_by
  ACCOUNT ||--o{ LEAVE_APPLICATION : files
  ACCOUNT ||--o{ POST : authors
  POST ||--o{ POST_LIKE : liked
  POST ||--o{ POST_COMMENT : commented
  ACCOUNT ||--o{ NOTIFICATION : receives
  SCHOOL_PROFILE ||--o| SUBSCRIPTION : billed
```

## Indexing notes

- FK columns indexed; composite indexes for hot queries (`academic_item(class_id, created_at)`,
  `notification(recipient_account_id, read_at)`, `membership(account_id, status)`).
- Unique constraints double as integrity guards for RBAC (one class teacher per class; one membership per
  account+context).
