# PRD — Attendance

`Status: Draft` · `Last updated: 2026-08-07`

A register per class per day. **Requirements before code** — S8-4, following the gradebook's order.

## Why this is the gradebook again, and where it is not

A register is a per-pupil fact with the same audience as a mark: the pupil, their parents through the
link the school confirmed (FR-GRADE-005), the teacher, the class teacher, the principal, the school.
If the gradebook's visibility rules were right, this should reuse them almost unchanged — and if it
cannot, they were wrong.

Two deliberate differences:

1. **A register is a class-level fact, not a subject-level one.** Marks belong to a subject and only
   that subject's teacher may see them. Attendance belongs to the day, and **any teacher who teaches
   this class may read it** — knowing who is in the room is part of teaching it.
2. **A parent reads it daily.** Homework is read when it is set; a register is read every morning by
   somebody deciding whether to worry. Its read path is the most latency-sensitive thing in the
   product.

## The register

| ID         | Priority | Requirement                                                         | Acceptance criteria                                                                                                               |
| ---------- | :------: | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| FR-ATT-001 |    P0    | The **class teacher** takes a register for their class, for a date. | One entry per verified pupil per date. Re-taking the same date updates it rather than adding a second register.                   |
| FR-ATT-002 |    P0    | Each pupil is `PRESENT`, `ABSENT`, `LATE` or `EXCUSED`.             | Four states, not a boolean. A pupil who arrived late was there; a pupil the school excused is not the same as truant.             |
| FR-ATT-003 |    P0    | The school may take or amend any register in its own school.        | The same reason the school can read every mark: it owns the data and covers for a teacher who has left.                           |
| FR-ATT-004 |    P1    | Amending a taken register is **audited**.                           | `AuditLog` records actor, pupil, previous state and new state. A register is evidence, and evidence that changes silently is not. |
| FR-ATT-005 |    P2    | A register may be taken for a past date, not a future one.          | Tomorrow's attendance is not a fact. A date beyond today is refused.                                                              |

**A register is taken in one action for the whole class**, like marks are entered. Half a register is
not a smaller register — it is a class where nobody knows who is missing.

## The thing the product already knows

**The school has often already approved the absence it is about to record.** `LeaveApplication`
holds an accepted leave with a start and end date, decided by the class teacher or principal
(FR-WF-002, FR-WF-003). An attendance feature that ignores it would let a school mark a child absent
on a day it had itself agreed they could be away — and then send the parent a notice about it.

| ID         | Priority | Requirement                                                                            | Acceptance criteria                                                                                                                        |
| ---------- | :------: | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-ATT-010 |    P0    | A pupil with **accepted leave** covering that date is offered as `EXCUSED` by default. | The register pre-fills `EXCUSED` for them, and says why. A teacher may still change it — the leave is a fact, the register is a judgement. |
| FR-ATT-011 |    P1    | Leave accepted _after_ a register was taken does not silently rewrite it.              | The past register stands; amending it is a deliberate act and is audited (FR-ATT-004).                                                     |

Leave is applied for by a parent naming a **child**, or by a student for themselves. Resolving the
first to a pupil account needs `Child.studentAccountId` — the link the school confirms — which is the
second time that link has been load-bearing, and the reason it exists.

## Telling a parent

| ID         | Priority | Requirement                                                         | Acceptance criteria                                                                                                                            |
| ---------- | :------: | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-ATT-020 |    P1    | A parent is notified when their child is marked `ABSENT` or `LATE`. | One notification naming the date and the state. **Not** `PRESENT` — a message every morning saying nothing happened is a message nobody reads. |
| FR-ATT-021 |    P1    | `EXCUSED` does not notify.                                          | The school already agreed to it; telling a parent their approved leave was honoured is noise.                                                  |

**This is the requirement most likely to be wrong in the first version, and it is a product
question, not a technical one.** A parent finding out at 09:30 that their child is not in school is
the single most valuable thing this feature can do — and the same message, sent because a teacher
mis-tapped a row, is the most alarming thing the product can send. Whether it goes immediately or on
a delay that lets a correction land first belongs to whoever answers for that phone call.

## Who may see a register

| Reader                            | Sees                                      |
| --------------------------------- | ----------------------------------------- |
| The pupil                         | Their own attendance                      |
| Their verified parent             | Their own child's, via the confirmed link |
| Any teacher who teaches the class | The whole register — see the note above   |
| The class teacher                 | The whole register, and takes it          |
| The principal                     | Every register in the school              |
| The school account                | Everything, and may amend                 |
| Another pupil, another parent     | **Nothing**                               |

| ID         | Priority | Requirement                                          | Acceptance criteria                                                         |
| ---------- | :------: | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| FR-ATT-030 |    P0    | A pupil sees only their own attendance.              | Another pupil's returns **404**, as the gradebook does.                     |
| FR-ATT-031 |    P0    | A parent sees only the child their membership names. | Refused entirely while the school has not linked that child (FR-GRADE-005). |

## What this deliberately does not do

**No per-period registers.** A secondary school takes attendance every lesson; a primary takes it
once. Doing both means a register that means different things in different schools, and the timetable
already exists to hang the harder version off later. `FR-ATT-040+` is reserved.

**No statistics, no percentages, no flags.** "Attendance below 90%" is a threshold with consequences
attached, and consequences are a policy the product does not have. Counting is easy; deciding what a
count means is not.

**No lateness in minutes.** `LATE` is a state, not a duration.

## Open questions for product

1. **When does the absence notification go out** — immediately, or after a grace period that lets a
   mis-tap be corrected? See FR-ATT-020.
2. **May a parent explain an absence from the app**, turning `ABSENT` into `EXCUSED` retrospectively?
   That is close to leave, which already exists, and the two should not become rival mechanisms.
3. **Retention.** Attendance is a legal record in many jurisdictions and outlives everything else
   here.
