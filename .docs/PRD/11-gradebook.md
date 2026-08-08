# PRD — Gradebook

`Status: Draft` · `Last updated: 2026-08-07`

Assessments and the marks students get for them. **Requirements before code** — S7-5, and the reason
S7-5 precedes S7-6 in the sprint plan.

> **This document answers S7-0c.** The roadmap lists the gradebook and the mobile app side by side
> under "later phases" with no order between them. Starting here chooses the gradebook: mobile is a
> second client for an API that already works, while this is a capability the product does not have
> and every school asks for. Mobile also brings a store presence, a release train and push
> infrastructure — a phase, not a sprint.

## Why this one is different from everything before it

Every academic feature so far is **logistics**: homework was set, a notice was published, a period
runs at nine o'clock. Facts about the class, seen by the class.

A mark is a fact about **one child**, and it is the first thing this product will hold that a child
would be upset to see shared. That changes what the permission model is for. Until now it protected
a school's data from outsiders; here it protects a student from the rest of their own class.

Two consequences run through everything below:

1. **Nobody sees a mark that is not theirs, their child's, or theirs to teach.** Not classmates, not
   other parents, not teachers of other subjects.
2. **A mark is never visible while it is being entered.** A teacher marking thirty scripts is
   half-finished for most of an evening, and a parent refreshing in that window would see a number
   that is not yet true.

## Assessments

| ID           | Priority | Requirement                                                                                  | Acceptance criteria                                                                                                                         |
| ------------ | :------: | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-GRADE-001 |    P0    | A verified teacher creates an **assessment** for a subject in a class they are allocated to. | Title, kind (test/exam/assignment/practical), date, maximum mark. Refused for a subject the teacher is not allocated to, as FR-ACAD-001 is. |
| FR-GRADE-002 |    P0    | The teacher who created it, or the school, may edit or delete it.                            | Soft-delete. Deleting an assessment hides its marks; it does not silently keep them readable.                                               |
| FR-GRADE-003 |    P1    | An assessment lists the students it applies to.                                              | The verified students of that class at the time of creation. A student verified later is added; a revoked one is not removed from history.  |

## Which pupil a mark is about

Found by starting the implementation, and it should have been found while writing this document.

The product held **two unconnected representations of a pupil**: a `Child` row owned by a parent,
and a student `Account` with a verified STUDENT membership. Nothing joined them, and nothing needed
to — homework fans out to class _members_ and read tracking is per account. A mark is the first
thing that is _about_ a pupil, so as written FR-GRADE-020 and FR-GRADE-021 could not both hold: a
mark on a student account is invisible to the parent, and a mark on a child record is invisible to
the student.

**Decided: the school links them, at verification.** It is the school that holds both halves — it
approved the parent's request naming the child and the student's own request — and nobody else can
know the answer. A parent claiming the link would be asserting something about an account they do
not own.

| ID           | Priority | Requirement                                                                  | Acceptance criteria                                                                                                                                                     |
| ------------ | :------: | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-GRADE-005 |    P0    | The school confirms that a child record and a student account are one pupil. | `PUT /schools/:id/children/:childId/student`. Only the school. The account must hold a **verified STUDENT membership in that child's class**; anything else is refused. |
| FR-GRADE-006 |    P0    | The link can be corrected or removed, and every change is audited.           | `null` unlinks. The audit row carries the previous value as well as the new one.                                                                                        |

**Two parents of one pupil each hold their own child record**, so the link is many-to-one: a unique
constraint on the pupil's account would let the first parent link and refuse the second forever.

**A pupil with no account of their own cannot be marked.** The link is nullable and stays null for
them. That follows from the roster already being made of accounts rather than from this decision,
but it is a real limit and it belongs here rather than in a surprise later.

## Marks

| ID           | Priority | Requirement                                                               | Acceptance criteria                                                                                                                                                   |
| ------------ | :------: | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-GRADE-010 |    P0    | The allocated teacher enters a mark per student, as a **draft**.          | Score against the assessment's maximum, optional grade label, optional remark. Drafts are visible **only** to the teacher and the school.                             |
| FR-GRADE-011 |    P0    | The teacher **publishes** the assessment's marks in one action.           | All marks become visible together. A partially marked assessment cannot be published without an explicit "leave blank" per missing student.                           |
| FR-GRADE-012 |    P0    | A published mark can be corrected, and every correction is **audited**.   | `AuditLog` records actor, previous value, new value, and time. The student and parent see the corrected mark; the audit trail is not shown to them.                   |
| FR-GRADE-013 |    P1    | Publishing notifies the student and their verified parents.               | One notification per recipient naming the assessment, not the mark. The mark itself is behind the read.                                                               |
| FR-GRADE-015 |    P0    | A teacher may write a **staff note** a pupil and their parents never see. | A second field, not a flag. Returned only on the marking view; the pupil's and parent's response shapes have nowhere to put it. Labelled in the UI by _who reads it_. |
| FR-GRADE-014 |    P2    | A mark may be withheld for one student without blocking the rest.         | An absent or ungraded student shows as "not marked", not as zero. Zero is a score; absence is not.                                                                    |

## Who may see a mark

The question the sprint's definition of done names explicitly. This table is the answer, and the
permission matrix carries the same rows.

| Reader                                          | Sees                                                      | Why                                                                        |
| ----------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| The student                                     | Their own marks, once published                           | It is a fact about them                                                    |
| Their verified parent                           | The marks of **their own child** only                     | Parent membership is already scoped to a child (`childId`)                 |
| The teacher allocated to that subject           | Every mark for their own assessments, draft and published | They entered them                                                          |
| The class teacher                               | Every published mark in their class, all subjects         | They answer for the class as a whole; this is the one cross-subject reader |
| The principal                                   | Every published mark in the school                        | Academic oversight is the role                                             |
| The school account                              | Everything, including drafts                              | It owns the data and must be able to correct a teacher who has left        |
| Another teacher of the same class               | **Nothing** for subjects they do not teach                | Being in the same staff room is not a reason                               |
| Another student, another parent, a general user | **Nothing**                                               | The promise this feature stands on                                         |

| ID           | Priority | Requirement                                                          | Acceptance criteria                                                                                                         |
| ------------ | :------: | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| FR-GRADE-020 |    P0    | A student sees only their own marks.                                 | Requesting another student's mark returns **404**, not 403 — consistent with the rest of the API's authorization behaviour. |
| FR-GRADE-021 |    P0    | A parent sees only the marks of the child their membership names.    | A parent of two children at one school sees each child's marks under that child, and neither under the other.               |
| FR-GRADE-022 |    P0    | A teacher sees marks only for subjects they are allocated to.        | Cross-subject reads refused even within a class they teach in.                                                              |
| FR-GRADE-023 |    P1    | The class teacher and principal see published marks across subjects. | Drafts excluded — an unpublished mark is not a fact yet.                                                                    |

## What this deliberately does not do

**No rank, no position, no class distribution to students or parents.** A student may see their own
mark and the assessment's maximum. They may not see the class average, the highest mark, or their
position — none of which can be shown without telling a child how they compare to people who did not
consent to the comparison. A teacher and the principal may see aggregates, because that is what the
number is for on their side.

This is a product decision rather than a technical one, and it is the one most likely to be
challenged. If it is reversed, it should be reversed in an ADR, not in a pull request.

**No report cards, no terms, no promotion.** A report card aggregates marks across subjects and a
term, and it is a document a school stands behind — signatures, formats, a grading scale that
differs per board. It needs its own requirements. `FR-GRADE-030+` is reserved.

**No attendance.** It is the other thing the legacy product implied and never shipped, and it is not
this.

## Decided

**The grading scale: raw score and percentage, and nothing else** (decided 2026-08-08). A mark
prints as `17.5 out of 20 (88%)`. No letters, no bands, no boundaries anywhere in the product.

The reason is that a scale is the one part of this that genuinely differs per board, and every way
of holding it is worse than not holding it yet. One fixed scale would mislabel marks for any school
whose board disagrees. Per-school bands are real work — a scale entity, per-school configuration,
and a migration story for a school that changes its bands mid-year — and none of it is needed to
put a report card in front of a parent. Letter bands remain possible later precisely because the
raw score is what is stored; presentation can be added without touching a single mark.

**A teacher may keep a note the family does not see** (decided 2026-08-08, FR-GRADE-015). A second
field rather than a flag on the shared one, because the question a teacher answers while typing is
_who is this for_, and a field answers it where a checkbox invites forgetting.

Two things the UI must keep saying. Each field is labelled by **who reads it** — "the pupil and
their parents will see this", "not shown to the family" — because "private note" tells a teacher
nothing about whom "private" excludes. And **private is not absolute**: a subject access request
still reaches it, and a note written as though nobody will ever read it is a note that will be read
out at the worst possible moment.

## Open questions for product

1. **Retention.** Marks are the longest-lived data in the product. How long after a student leaves?

## Legacy

The original product scaffolded a `SchoolResults` screen and disabled it before release
(`docs/16-missing-features.md`). Nothing about its design survives, so nothing here inherits from
it — this is new, and the legacy note exists only so nobody goes looking.
