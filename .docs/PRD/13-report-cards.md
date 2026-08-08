# PRD — Report cards

`Status: Draft` · `Last updated: 2026-08-08`

What a school hands a family at the end of a term. **Requirements before code** — S8-6, following the
gradebook and attendance.

## The thing that makes this different from everything before it

Every screen in this product so far is a **view**: it shows what is true now, and if the underlying
fact changes the screen changes with it. That is right for homework, for a register, for a mark.

**A report card is a document.** A school hands it over, a family keeps it, and somebody may produce
it two years later. If it were computed live from marks, then correcting one mark in March would
silently rewrite a card issued in December — and the school would have two different documents with
the same name and no way to tell which one a parent is holding.

So a card is **issued**, not rendered. Issuing takes a copy of every number on it. A later correction
to a mark does not touch a card that has already been issued; a school that wants the card to reflect
it **reissues**, and the reissue is recorded and visible.

This is the same instinct as publishing marks, one step further: publishing decides _when_ a fact
becomes visible, issuing decides _which version of it_ a document preserves.

## A term

The product has no notion of one, and a card is "the term's" work. A term is the school's to define —
boards and countries disagree about how many there are and when they run.

| ID           | Priority | Requirement                                                   | Acceptance criteria                                                                                                            |
| ------------ | :------: | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| FR-GRADE-030 |    P0    | A school defines its own **terms**: a name and a date range.  | Named freely ("Term 1", "Michaelmas"). Ranges may not overlap within a school — an assessment must belong to one term or none. |
| FR-GRADE-031 |    P1    | A term may be edited until a card has been issued against it. | After that its dates are frozen: they are printed on documents families hold.                                                  |

## What a card contains

Built from data, never typed. Everything on it is derivable, and the parts that are not derivable are
not on it.

| ID           | Priority | Requirement                                                                  | Acceptance criteria                                                                                                                                |
| ------------ | :------: | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-GRADE-032 |    P0    | Per subject: each **published** assessment in the term, and a subject total. | Total scored over total available, and the percentage. Unpublished assessments are not on it and do not count.                                     |
| FR-GRADE-033 |    P0    | An unmarked pupil does not score zero.                                       | An assessment they were not marked for is excluded from both sides of their total — the same rule as FR-GRADE-014, carried through the arithmetic. |
| FR-GRADE-034 |    P1    | An **attendance summary** for the term: present, absent, late, excused.      | Counts, not a percentage — "attendance below 90%" is a threshold with consequences, and consequences are a policy the product does not have.       |
| FR-GRADE-035 |    P1    | An optional **overall comment** from the class teacher.                      | The one typed field on the card. Shared with the family, like a mark's remark.                                                                     |
| FR-GRADE-036 |    P0    | **No staff notes, no rank, no class average, no position.**                  | The card carries what a family is owed about their own child and nothing about anybody else's.                                                     |

**Percentages are computed from raw marks** (S8-0c, decided 2026-08-08): `17.5/20` prints as `88%`.
No letters and no bands, because a scale is the part that differs per board and the raw score is what
is stored.

## Issuing

| ID           | Priority | Requirement                                                                | Acceptance criteria                                                                                                          |
| ------------ | :------: | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| FR-GRADE-040 |    P0    | The **class teacher or the school** issues cards for a class and a term.   | One action for the whole class, like taking a register: a term where half the class has a card is a term nobody can explain. |
| FR-GRADE-041 |    P0    | Issuing **snapshots** every number and the comment.                        | A later correction to a mark leaves an issued card unchanged.                                                                |
| FR-GRADE-042 |    P0    | A card may be **reissued**, and the reissue is recorded and shown.         | `AuditLog` keeps who and when; the card shows that it replaced an earlier one and the date of that one.                      |
| FR-GRADE-043 |    P1    | A pupil and their parents see an issued card; nobody sees an unissued one. | Same shape as a draft mark: before issue it does not exist for a family.                                                     |

**Why the whole class at once.** A card is a comparison-free document, but a term in which some
families have one and others do not is itself information about who the school got to. Issuing per
class removes the question.

## Who sees a card

The gradebook's table, unchanged, because a card is made of marks:

| Reader                        | Sees                                                  |
| ----------------------------- | ----------------------------------------------------- |
| The pupil                     | Their own issued cards                                |
| Their verified parent         | Their own child's, via the school-confirmed link      |
| The class teacher             | Every card in their class, issued or not              |
| The principal                 | Every card in the school                              |
| The school account            | Everything, and issues                                |
| A subject teacher             | **Nothing** — a card spans subjects they do not teach |
| Another pupil, another parent | **Nothing**                                           |

A subject teacher being excluded is a deliberate change from marks, where they see their own subject.
A card is a statement about a child across their whole school life that term, and teaching them
French is not a reason to read it.

## What this deliberately does not do

**No PDF, no print layout, no signature block.** A card is a screen for now. A PDF is a promise about
pagination, fonts and a school's letterhead, and it is a different piece of work from deciding what
the card _says_. `FR-GRADE-050+` is reserved.

**No progression or promotion.** Whether a child moves up a year is a decision with consequences, and
the product does not hold the policy that would justify making it.

**No cross-term comparison.** "Improved since last term" is a judgement, and it is the kind that
reads very differently depending on which child is holding it.

## Open questions for product

1. **May a parent download or share a card?** It is the first document families will want to keep,
   and the answer shapes whether a PDF is a nice-to-have or the point.
2. **What happens to a pupil who joins mid-term?** Their card is honest but thin, and a school may
   prefer to withhold one rather than issue something that reads as underperformance.
3. **Retention**, again, and more sharply than for marks: a card is the artefact a family is most
   likely to ask for years later.
