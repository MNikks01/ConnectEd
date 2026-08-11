# PRD — Export and erasure

`Status: Draft` · `Last updated: 2026-08-11`

The two subject rights [`Security/04-compliance.md`](../Security/04-compliance.md) has promised since
Sprint 2 and the product has never had. B-9 in
[`Product/05-what-is-blocked-on-you.md`](../Product/05-what-is-blocked-on-you.md), and the
highest-priority unblocked work in the project.

**Requirements before code**, like the gradebook, attendance and report cards before it.

## Why this is not a CRUD feature

Every other module in this product answers "who may see this?". This one answers a different
question — **"what is a person, in a database that was designed around schools?"** — and the answer
turns out to be structural rather than a matter of listing tables.

Three things make it hard, and each of them is a decision rather than an implementation detail.

**A `DELETE` cascade would destroy somebody else's records.** Every academic table points at
`account.id`. `attendance_entry` names the pupil it is about; `mark` names the pupil and the teacher
who wrote it; `academic_item` names the teacher who set the homework. `onDelete: Cascade` runs down
all of them. A pupil exercising a right they unambiguously have would take a term of the school's
register with them — and a register is a legal record in most jurisdictions the pilot could launch
in. **The school's records are not the pupil's to delete, and the pupil's identity is not the
school's to keep.** Both halves have to hold at once.

**An export is a copy of a person, sitting in a bucket.** Everything else this product stores is
scattered across fifty tables behind fifty authorization checks. An export is all of it in one file,
authorized once. That is a new blast radius the product has not had before, and it is the reason
exports expire, are counted, and are swept.

**A conversation has two people in it.** Exporting a message thread exports the other party's words.
A subject-access right is a right to _your_ data; handing over somebody else's private messages
because they happened to be addressed to you is a disclosure, not a portability feature.

## Scope

A person, acting on their own account, without asking anybody. That is what a subject right means —
a right that requires a support ticket is a favour.

**Out of scope, deliberately:** a school erasing itself (see FR-DSR-020), erasure on behalf of
somebody else, and retention-driven purging of a leaving pupil. The last is
[B-4](../Product/05-what-is-blocked-on-you.md#b-4--retention), unanswered, and it is a **different
mechanism with the same machinery** — a scheduled purge by policy rather than a request by a person.
This PRD builds the machinery; B-4 decides when it fires on its own.

---

## Export

| ID         | Priority | Requirement                                                                     | Acceptance criteria                                                                                                                           |
| ---------- | :------: | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-DSR-001 |    P0    | Any account may **request an export of its own data**.                          | One request per account at a time. A second while one is pending is a conflict, not a queue — the answer would be identical.                  |
| FR-DSR-002 |    P0    | The export is **built asynchronously** and the caller is told when it is ready. | A request returns immediately with a status. The bundle is built by the worker; a notification is written when it is ready.                   |
| FR-DSR-003 |    P0    | The bundle is **machine-readable and complete for its subject**.                | One JSON document, versioned, with a manifest naming every section and its row count. Portability means a machine can read it (GDPR Art. 20). |
| FR-DSR-004 |    P0    | It is downloaded through a **short-lived signed URL**, by the owner only.       | Same mechanism as media (ADR-0009). The object is private; possession of a key is never authorization.                                        |
| FR-DSR-005 |    P0    | An export **expires**, and the object is deleted when it does.                  | 7 days. After that the row reads `EXPIRED`, the object is gone, and a new request is needed. See "why an export expires" below.               |
| FR-DSR-006 |    P1    | Every download is **counted and audited**.                                      | `AuditLog` records the request, the completion and each download. A bundle downloaded eleven times is worth being able to notice.             |
| FR-DSR-007 |    P1    | A failed build is **visible and retryable**, not silent.                        | Status `FAILED` with a reason the owner can read; requesting again is permitted immediately.                                                  |

### What the bundle contains

The rule is **facts about the subject, and the subject's own contributions** — not the surrounding
context that happens to mention them.

| Section         | Contains                                                                       | Notes                                                                                         |
| --------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `account`       | Email, type, status, timestamps, email-verification state                      | Never the password hash, never a token — see FR-DSR-010                                       |
| `profile`       | Name, handle, mobile, gender, DOB, bio, achievements, visibility               | The school variant for a `SCHOOL` account                                                     |
| `children`      | Each `Child` row the account owns, and its school and class                    | A parent's record of their own children                                                       |
| `memberships`   | Every membership, its role, scope, status and verification history             | Includes rejections — a refusal is a fact about the subject                                   |
| `academics`     | Items **they authored**; notices they published                                | A teacher's homework is theirs; a pupil's _view_ of homework is the class's                   |
| `marks`         | Marks **about them**, published ones only                                      | With the assessment and the subject. Never the class distribution — FR-GRADE-036 applies here |
| `attendance`    | Register entries about them                                                    | Date and state                                                                                |
| `reportCards`   | Every card issued to them, snapshot included                                   | The document, exactly as issued                                                               |
| `workflows`     | Leave applications they filed, and the decision                                | Including a rejection and its reason                                                          |
| `social`        | Posts, comments and likes they wrote; follows and connections                  | Bodies included — they are the subject's own words                                            |
| `messages`      | Messages **they sent**, and the counterparty's handle                          | **Not the other party's messages.** See below                                                 |
| `notifications` | Their notifications and preferences                                            |                                                                                               |
| `media`         | Object keys and metadata they own, with signed URLs valid for the export's TTL | Not the bytes. A term of homework photos in a JSON file is a different product                |
| `feedback`      | Feedback they submitted to a school                                            |                                                                                               |
| `moderation`    | Reports **they raised**                                                        | Not reports about them — see FR-DSR-011                                                       |

| ID         | Priority | Requirement                                                                        | Acceptance criteria                                                                                                                                                      |
| ---------- | :------: | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-DSR-010 |    P0    | The bundle **never contains authentication material**.                             | No password hash, no refresh token, no 2FA secret, no recovery code, no reset token. A leaked export must not be a leaked account.                                       |
| FR-DSR-011 |    P0    | The bundle **never contains another person's data**.                               | Not the other party's message bodies; not a report raised _about_ the subject, which would identify the reporter; not another pupil's marks or the class distribution.   |
| FR-DSR-012 |    P0    | A **school's** export contains the institution's own record, not its pupils' data. | Profile, classes, subjects, terms, subscription and its own notices. A school asking for "its data" and receiving four hundred children's marks is the failure to avoid. |
| FR-DSR-013 |    P1    | The bundle carries a **manifest**: schema version, generated-at, section counts.   | A reader can tell what they have and whether it is complete. An empty section is present and empty, never absent.                                                        |

**Why messages are one-sided.** The alternative — export the whole thread — was considered and
rejected. A thread is a shared object, but the _words_ in it are not: the counterparty wrote theirs
under an expectation that the audience was one person, not one person and whoever later reads their
export file. Exporting only the subject's own messages loses conversational context, and the
counterparty's handle is included so the subject can at least tell whom they were talking to. If a
regulator later requires the full thread, that is a change to this line and nothing else.

**Why an export expires.** The bundle concentrates in one object what the product otherwise keeps
behind fifty separate authorization checks. A signed URL is short-lived, but the object behind it is
not, and an object that lives forever is one storage misconfiguration away from being the worst
single file in the system. Seven days is long enough to notice an email and download a file, and
short enough that the concentrated copy is not a permanent fixture. The TTL is a constant, in one
place, and it is a policy number rather than a technical one.

---

## Erasure

| ID         | Priority | Requirement                                                                       | Acceptance criteria                                                                                                                                               |
| ---------- | :------: | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-DSR-020 |    P0    | An **individual** may request erasure of their own account. A **school may not**. | A school is a data controller, not merely a subject; erasing it would destroy every pupil's academic record. Refused with an explanation, not a 403 with nothing. |
| FR-DSR-021 |    P0    | Erasure is **scheduled, not immediate**: a 30-day grace period.                   | The commonest reason to press the button is a bad afternoon. `scheduledFor = requestedAt + 30 days`.                                                              |
| FR-DSR-022 |    P0    | The requester may **cancel** at any point before it executes.                     | One action, no support ticket. After execution there is nothing left to cancel and nobody left to ask.                                                            |
| FR-DSR-023 |    P0    | During the grace period the account **still works**, and says what is coming.     | Suspending immediately would punish the change of mind the grace period exists for. Every session sees the pending date.                                          |
| FR-DSR-024 |    P0    | Execution **deletes what is only about the person** and **severs the rest**.      | The disposition table below is the contract. Every table in the schema appears in it.                                                                             |
| FR-DSR-025 |    P0    | Execution is **transactional**.                                                   | A half-erased account is worse than an un-erased one: it is an account nobody can sign into and whose data is still there.                                        |
| FR-DSR-026 |    P0    | After execution the account **cannot be signed into and cannot be found**.        | No login, no profile, no handle, no search result, no membership. The email is released so the person may register again.                                         |
| FR-DSR-027 |    P0    | Erasure is **audited**, and the audit survives it.                                | `AuditLog` keeps the request, the cancellation and the execution, with row counts per table. It names an id that no longer resolves to a person.                  |
| FR-DSR-028 |    P1    | A pending erasure **blocks a new export request**.                                | Building a copy of a person hours before deleting them is the one ordering that produces an orphaned bundle nobody can reach.                                     |

### What survives, and why

**The `account` row survives as a tombstone.** This is the decision the rest follows from, and it is
recorded in [ADR-0020](../ADR/0020-erasure-by-tombstone.md).

Deleting the row is what a reader expects erasure to mean, and it is the wrong mechanism here: fifty
foreign keys point at it, and the cascade takes a school's register, its mark history and its
homework with it. So the row stays, stripped of everything that identifies anybody — a stable,
meaningless id that the school's records can continue to point at — and every table that is _only_
about the person is deleted outright.

The test to apply to each table is one question: **if this row vanished, would somebody other than
the subject lose a record they are entitled to?**

| Disposition                    | Tables                                                                                                                                                                                                   | Why                                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Deleted**                    | `credential`, `refresh_token`, `password_reset_token`, `two_factor_secret`, `recovery_code`, `two_factor_challenge`, `login_throttle`, `push_token`, `notification`, `notification_pref`, `read_receipt` | Authentication material and personal plumbing. Nobody else has an interest in any of it.                                          |
| **Deleted**                    | `user_profile`, `child`, `post`, `post_like`, `post_comment`, `follow`, `connection`, `block`, `message`, `feedback`, `data_export`                                                                      | The person's own content and their own records of their children. A parent's `Child` row is theirs; the _pupil's_ account is not. |
| **Deleted, conditionally**     | `message_thread` — only when nothing is left in it; `media_object` — only the display picture and the images on the person's own posts                                                                   | See the two notes below. Both were "delete everything of theirs" until implementing them showed what that would take with it.     |
| **Severed** (kept, anonymised) | `membership`, `verification_request`                                                                                                                                                                     | The school's record that somebody held a place. Reduced to the tombstone, keeping role, class and dates.                          |
| **Severed**                    | `mark`, `attendance_entry`, `report_card`, `assessment` (authored), `academic_item`, `notice`, `leave_application`                                                                                       | The school's academic and legal record. A register with a hole in it is not a register.                                           |
| **Severed**                    | `report` (raised by), `audit_log`                                                                                                                                                                        | Moderation evidence and the audit trail. An audit that can be erased by its subject is not an audit.                              |
| **Untouched**                  | `outbox_event`, `plan`, `subscription`, `class`, `subject`, `term`, `timetable`                                                                                                                          | Not about a person. Outbox payloads are swept on their own schedule (ADR-0019) and carry ids rather than profiles.                |

**Two rows in that table changed while it was being built, and both are worth recording.**

_A thread is not the subject's to delete._ Deleting `message_thread` alongside the subject's
messages cascades into the **counterparty's** messages — words written by somebody else, about
themselves, in their own conversation. So only the subject's `message` rows go; the thread stays if
anything of the other party's remains, showing "A former member" on one side, and is deleted only
when it is empty. This is the mirror of FR-DSR-011 on the export side: your words, not theirs.

_Not every uploaded object is the uploader's to take._ `media_object` was "deleted (owned)", which
would remove the photograph attached to a homework item the class still has — the item survives as
the school's record and would be left pointing at a key that 404s. Only the display picture and the
images on the person's own deleted posts go. The rest is severed, keeping the row the orphan sweep
reads; `uploaded_by` is documented in the schema as an audit trail rather than an authorization
input, so a tombstone in it costs nothing.

**A severed row shows a name.** Every screen that renders an author, a marker or a member reads a
profile that is now gone. Those screens must render **"A former member"** rather than a blank or a
crash, and that is a requirement rather than a fallback:

| ID         | Priority | Requirement                                                            | Acceptance criteria                                                                          |
| ---------- | :------: | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| FR-DSR-030 |    P0    | Any view of a severed account renders a **neutral placeholder**.       | "A former member". Never blank, never `null`, never an id, and never a 500.                  |
| FR-DSR-031 |    P0    | A severed account is **excluded from every list, search and fan-out**. | It receives no notifications, appears in no directory, and is not a recipient of anything.   |
| FR-DSR-032 |    P1    | A **teacher's allocations and class-teacher rows are released**.       | Erasing a teacher must not leave a class with a class teacher nobody can contact or replace. |

**What erasure does not do.** It does not remove the subject from somebody else's export that has
already been downloaded, from a backup taken before it ran, or from a report somebody raised about
them. The first two are inherent; the third is deliberate. All three belong in the privacy notice,
not in a footnote — the product should say what it can do and not imply more.

---

## Non-functional

| NFR     | How this satisfies it                                                                                             |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| NFR-006 | This document, implemented and tested, is the requirement. It moves from ⛔ to ✅ when both flows run end to end. |
| NFR-004 | Export builds off the request path entirely; a school with four hundred pupils must not block a request thread.   |
| NFR-005 | The export is the highest-value single object in the product. Owner-only, signed, expiring, counted.              |
| NFR-013 | Erasure execution is transactional (FR-DSR-025) and its row counts are audited (FR-DSR-027).                      |

## Open questions

1. **Should a school be notified when a member erases themself?** Today it discovers a former member.
   Arguably the school needs to know a pupil has left; arguably telling it defeats the point.
2. **How long is the grace period, really?** 30 days is the GDPR-shaped default. A school year has a
   different rhythm and this is a product call.
3. **Does a minor's erasure need guardian consent?** `Security/04-compliance.md` records consent for
   student accounts at registration. Erasure is the mirror image and the document is silent on it.

These are recorded in [`Product/05-what-is-blocked-on-you.md`](../Product/05-what-is-blocked-on-you.md);
none of them blocks the mechanism.

## Related

- [ADR-0020 — erasure by tombstone](../ADR/0020-erasure-by-tombstone.md)
- [`Security/04-compliance.md`](../Security/04-compliance.md) — the promise this pays off
- [`PRD/09-permissions-matrix.md`](09-permissions-matrix.md) — the contract these endpoints are tested against
