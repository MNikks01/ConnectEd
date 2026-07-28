# 03 — User Personas

Personas below are realistic constructions inferred from the roles, fields, and workflows found in the code. They are illustrative, not real users.

---

## Persona 1 — Anita Sharma · The Parent

- **Role:** Parent (`USER_CURRENT_STATUS = PARENT`)
- **Age / context:** 38, mother of two children in the same school, moderately tech-comfortable, uses an Android phone.
- **Devices:** Mobile app (primary).

**Goals**
- Know exactly what homework, projects and notices apply to each child.
- Switch between her two children quickly (the app has a "currently selected child" concept).
- Apply for her child's leave without writing a paper note.
- See the class timetable and how much syllabus has been covered.

**Frustrations the product removes**
- Missing notices buried in a WhatsApp group.
- Not knowing whether homework was actually assigned.

**Key features used:** Child selection, Projects & Homeworks, Notice Board, Timetable, Syllabus Covered, Leave Application (on behalf of child), Complaints & Feedback, plus the social feed.

**Verification touchpoint:** Each child must be verified into their class before Anita sees that class's academic data.

---

## Persona 2 — Rohan Verma · The Student

- **Role:** Student (`USER_CURRENT_STATUS = STUDENT`)
- **Age / context:** 15, Class 9, owns a phone, socially active.
- **Devices:** Mobile app.

**Goals**
- Check what's due today and this week.
- See the timetable and syllabus progress before exams.
- Stay connected — post, follow the school, message friends.

**Notes:** Students **cannot** submit leave applications in the app (the Leave module is hidden for students) and do not see the Leave/Complaints drawer entries. Their academic view is read-only; their social view is full.

---

## Persona 3 — Priya Nair · The Class Teacher

- **Role:** Teacher (`USER_CURRENT_STATUS = TEACHER`), also **class teacher** of one class.
- **Age / context:** 31, teaches Science to several classes, is class teacher of Class 7‑A.
- **Devices:** Mobile app for publishing; occasionally the website.

**Goals**
- Publish homework / assignments / projects to a specific subject + class and auto-notify parents.
- Update syllabus coverage as topics are taught.
- As class teacher, approve or reject leave applications from her class's students/parents.

**Key features used:** Projects & Homeworks (publisher), Syllabus Covered (editor), Leave Application (approver for her class), Notice Board (reader), Complaints & Feedback.

**Verification touchpoint:** Priya self-declares as a teacher and requests verification; the school verifies her and allocates the subjects/class she teaches.

---

## Persona 4 — Mr. Suresh Iyer · The Principal

- **Role:** Principal (`USER_CURRENT_STATUS = PRINCIPAL`)
- **Age / context:** 52, oversees the whole school.
- **Devices:** Mobile app + website.

**Goals**
- Oversee academic communication across all classes.
- Approve/reject **teachers'** leave applications (routed to the principal).
- Monitor complaints and feedback.

**Key features used:** Leave Application (teacher approvals), Notice Board, Complaints & Feedback, full academic visibility.

---

## Persona 5 — Greenfield Public School · The School (Institution)

- **Role:** School account (`SCHOOLS` collection)
- **Context:** A K‑12 school with English & Hindi mediums, multiple classes and sections.
- **Devices:** **Website only** (blocked on mobile).

**Goals**
- Create the school's full class structure (mediums → classes → sections → subjects).
- Verify incoming member requests (students, parents, teachers, principal).
- Manage verified members, allocate class teachers.
- Publish notices, upcoming events, timetables, syllabus, homework.
- Handle leave applications and complaints at the institutional level.
- Maintain the public school profile (about, mission, vision, facilities, achievements, photos).

**Key features used:** Everything in the school portal — Verification Requests, Verified Members, Add/Remove members, Class Teacher Allocation, Upcoming Events, Timetable, Syllabus, Homework, Notice Board, Complaints, Leave Applications, School Profile.

---

## Persona 6 — Karan Mehta · The General User

- **Role:** General User ("Just a User")
- **Context:** 24, alumnus / community member with no current academic role.
- **Devices:** Mobile app.

**Goals**
- Follow schools he's interested in, connect with friends, post and message.

**Notes:** Sees **only** the social layer (Home feed, Friends/Connections, Messages, Create Post, Account, Find Schools, Find Friends). No academic drawer entries. Chosen by selecting "User" at registration.

---

## Persona relationships

```
                 ┌─────────────┐
                 │   SCHOOL    │  (verifies everyone, owns academics)
                 └──────┬──────┘
        verifies        │
   ┌───────────┬────────┼────────┬───────────┐
   ▼           ▼        ▼        ▼           ▼
Student     Parent   Teacher  Principal   (General User — not school-affiliated)
   │           │        │
   │        manages     └─ may be Class Teacher (approves student leave)
   │        Child(ren)
   └── all actors also participate in the SOCIAL graph:
       follow schools/users · friend requests · posts · likes · comments · messages
```
