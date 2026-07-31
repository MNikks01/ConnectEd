# PRD — Permissions Matrix (server-enforced)

`Status: Accepted` · `Last updated: 2026-07-28`

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
| Submit leave application                      |   ➖    | ✅ (for child) |   ✅    |      ✅       |    ➖     |   ➖   |      ➖      |
| Approve student/parent leave                  |   ➖    |       ➖       |   ➖    |      ✅       |    ➖     |   👁    |      ➖      |
| Approve teacher leave                         |   ➖    |       ➖       |   ➖    |      ➖       |    ✅     |   👁    |      ➖      |
| Submit complaints/suggestions                 |   ➖    |       ✅       |   ✅    |      ✅       |    ✅     |   ➖   |      ➖      |
| Review complaints                             |   ➖    |       ➖       |    👁    |       👁       |    ✅     |   ✅   |      ➖      |
| Create school & class structure               |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Verify/remove members, allocate class teacher |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |
| Manage subscription/billing                   |   ➖    |       ➖       |   ➖    |      ➖       |    ➖     |   ✅   |      ➖      |

## Notes

- **Students**: Leave & Complaints modules are **hidden** (carried from legacy). Parents act for children.
- **General Users**: social + discovery only.
- **Principal**: view across academics + **teacher-leave approval**. Publishing homework is a teacher/school
  action — principals do **not** publish homework by default (**Assumption**, matches legacy inference).
- **Ownership rules**: users edit only their own content; schools manage only their own structure; teachers write
  only to allocated subjects/classes; class teachers approve leave only for their allocated class; parents act
  only within a verified child's scope.
- The matrix is the **product contract**; the **enforcement** contract lives in Security + API and must match it
  test-for-test (see permission integration tests in [`../Checklists/`](../Checklists/)).
