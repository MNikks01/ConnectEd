# PRD — Permissions Matrix (server-enforced)

`Status: Accepted` · `Last updated: 2026-08-07`

Legend: ✅ can do · 👁 view only · ➖ not available/hidden. **All enforced on the server** against role,
verification state, and resource ownership. See [`../Security/02-authorization.md`](../Security/02-authorization.md).

| Capability                                    | Student |     Parent     | Teacher | Class Teacher | Principal | School | General User |
| --------------------------------------------- | :-----: | :------------: | :-----: | :-----------: | :-------: | :----: | :----------: |
| Social: post/like/comment/follow/message      |   ✅    |       ✅       |   ✅    |      ✅       |    ✅     |   ✅   |      ✅      |
| View feed / profiles                          |   ✅    |       ✅       |   ✅    |      ✅       |    ✅     |   ✅   |      ✅      |
| Declare academic role                         |   ✅    |       ✅       |   ✅    |      ✅       |    ✅     |   ➖   |      ➖      |
| Submit verification request                   |   ✅    |       ✅       |   ✅    |      ✅       |    ✅     |   ➖   |      ➖      |
| Approve verification requests                 |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Publish homework/assignments/projects         |   ➖    |       ➖       |   ✅    |      ✅       |     👁     |   ✅   |      ➖      |
| View homework                                 |    👁    |       👁        |   ✅    |      ✅       |     👁     |   👁    |      ➖      |
| Publish notices                               |   ➖    |       ➖       |   ➖    |      ➖       |    ✅     |   ✅   |      ➖      |
| View notices                                  |    👁    |       👁        |    👁    |       👁       |     👁     |   ✅   |      ➖      |
| Create events                                 |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Upload timetable                              |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| View timetable                                |    👁    |       👁        |    👁    |       👁       |     👁     |   ✅   |      ➖      |
| Update syllabus coverage                      |   ➖    |       ➖       |   ✅    |      ✅       |     👁     |   ✅   |      ➖      |
| Create an assessment                          |   ➖    |       ➖       |   ✅    |      ✅       |     👁     |   ✅   |      ➖      |
| Enter and publish marks                       |   ➖    |       ➖       |   ✅    |      ✅       |     👁     |   ✅   |      ➖      |
| View a mark                                   |    👁    |       👁        |    👁    |       👁       |     👁     |   ✅   |      ➖      |
| Take a register                               |   ➖    |       ➖       |   ➖    |      ✅       |    ➖     |   ✅   |      ➖      |
| View a register                               |    👁    |       👁        |    👁    |       👁       |     👁     |   ✅   |      ➖      |
| Submit leave application                      |   ➖    | ✅ (for child) |   ✅    |      ✅       |    ➖     |   ➖   |      ➖      |
| Approve student/parent leave                  |   ➖    |       ➖       |   ➖    |      ✅       |    ➖     |   👁    |      ➖      |
| Approve teacher leave                         |   ➖    |       ➖       |   ➖    |      ➖       |    ✅     |   👁    |      ➖      |
| Submit complaints/suggestions                 |   ➖    |       ✅       |   ✅    |      ✅       |    ✅     |   ➖   |      ➖      |
| Review complaints                             |   ➖    |       ➖       |    👁    |       👁       |    ✅     |   ✅   |      ➖      |
| Create school & class structure               |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Verify/remove members, allocate class teacher |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Manage subscription/billing                   |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| View school analytics                         |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Review the moderation queue                   |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ➖   |      ➖      |

## Notes

- **The moderation queue is `➖` in every column, and that is the row's whole content.** It is read
  by ConnectEd staff holding `PLATFORM_ADMIN` (ADR-0017), which is not one of the seven kinds of
  user this table describes. Not the school and not the principal: a report is often _about_
  someone at the reporter's school, and the reporting form promises that nobody there is told. The
  suite asserts all seven refusals, because "no user role can read this" is a claim that regresses
  as quietly as any other.

- **School analytics** is the school account's alone, like billing — it is an admin surface on a
  web-only account, and the plan that unlocks it is the school's contract. It is also the only
  capability here **gated by a plan as well as by a role**: a school on a plan without
  `advancedAnalytics` gets `402`, not `403`, because it did nothing wrong.

- **Students**: Leave & Complaints modules are **hidden** (carried from legacy). Parents act for children.
- **General Users**: social + discovery only — _once settled in that state_. See the clarification below.

> **Clarification (2026-07-31, from implementing S1-4).** Read literally, the ➖ for General User on
> **Declare academic role** and **Submit verification request** makes onboarding impossible: `FR-AUTH-001`
> creates every individual with role `USER` — i.e. a General User — and `FR-AUTH-008` says individuals may
> declare an academic role. If the one role everybody starts in cannot declare, nobody can ever become a
> student.
>
> The ➖ is therefore read as describing what a General User can do **within a school** (nothing — they hold no
> membership), not as a bar on applying. **Implemented behaviour:** any individual account may submit a
> verification request; a `SCHOOL` account may not, which is what makes self-approval structurally impossible.
> The role a request declares confers nothing until the school approves it — the verified `membership` row is
> what every academic check reads.

- **Principal**: view across academics + **teacher-leave approval**. Publishing homework is a teacher/school
  action — principals do **not** publish homework by default (**Assumption**, matches legacy inference).
- **Ownership rules**: users edit only their own content; schools manage only their own structure; teachers write
  only to allocated subjects/classes; class teachers approve leave only for their allocated class; parents act
  only within a verified child's scope.
- **"View a register" is scoped the same way as "View a mark", with one difference.** Attendance is
  a _class-level_ fact, so **any** teacher of the class reads the whole register — knowing who is in
  the room is part of teaching it — where marks are subject-scoped. Pupils and parents still see one
  pupil's. `12-attendance.md` carries the table.
- **Taking a register is the class teacher's**, not any teacher's: FR-INST-004 already makes them
  the person who answers for the class, and two people taking the same register is how a class ends
  up with two answers about the same child.
- **"View a mark" is the one row this table cannot express, and the gap is the point.** Five roles
  read marks and every one of them reads a _different set_: a student their own, a parent their own
  child's, a teacher the subjects they are allocated to, the class teacher every published mark in
  their class, the principal every published mark in the school. A `👁` that means five different
  things is a contract nobody can test against, so the scoping table in
  [`11-gradebook.md`](./11-gradebook.md) is the contract for this row and the tests follow that.
  Marks are the first data in the product that must be protected from a member's own classmates
  rather than from outsiders.
- The matrix is the **product contract**; the **enforcement** contract lives in Security + API and must match it
  test-for-test (see permission integration tests in [`../Checklists/`](../Checklists/)).
