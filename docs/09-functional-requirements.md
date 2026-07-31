# 09 — Functional Requirements

Requirements are grouped by module and numbered. Each is written as an observable behaviour the product must exhibit, derived from the code. "M/W" indicates platform.

## Module: Authentication & Registration (FR-AUTH)

- **FR-AUTH-001** The system shall allow a new individual to register with first name, last name, email, mobile number, gender, date of birth, and password. (M/W)
- **FR-AUTH-002** The system shall enforce password minimum length of 8 characters and confirm-password match. (M/W)
- **FR-AUTH-003** The system shall validate email format before account creation. (M/W)
- **FR-AUTH-004** The system shall require the user to select one status at registration: Student, Parent, Teacher, or User. (M/W)
- **FR-AUTH-005** The system shall collect role-specific data: student (school/class), parent (child details), teacher (school/subjects), user (none). (M/W)
- **FR-AUTH-006** The system shall create a Firebase Auth account and a corresponding `USERS` document on registration. (M/W)
- **FR-AUTH-007** The system shall capture and store the device's Expo push token at sign-up/login. (M)
- **FR-AUTH-008** The system shall allow schools to register as institutional accounts with identity and academic-structure data. (W)
- **FR-AUTH-009** The system shall authenticate users via email/password. (M/W)
- **FR-AUTH-010** The system shall prevent school accounts from logging in on mobile and instruct them to use desktop. (M)
- **FR-AUTH-011** On web login, the system shall detect whether the account is a school or a user and route accordingly. (W)
- **FR-AUTH-012** The system shall show onboarding only on first app launch. (M)

## Module: Social (FR-SOC)

- **FR-SOC-001** The system shall let users and schools create posts containing text and image(s). (M/W)
- **FR-SOC-002** The system shall aggregate a feed from the accounts the user follows (schools + users). (M/W)
- **FR-SOC-003** The system shall let users like a post and record the like. (M/W)
- **FR-SOC-004** The system shall let users comment on a post. (M/W)
- **FR-SOC-005** The system shall let users follow/unfollow schools and users. (M/W)
- **FR-SOC-006** The system shall maintain followers and following lists for each account. (M/W)
- **FR-SOC-007** The system shall let users send connection (friend) requests. (M/W)
- **FR-SOC-008** The system shall let a recipient accept a request, forming a mutual connection. (M/W)
- **FR-SOC-009** The system shall display a badge with the count of pending received requests. (M/W)
- **FR-SOC-010** The system shall let connected users exchange 1:1 messages. (M/W)
- **FR-SOC-011** The system shall track message read state and badge unread messages. (M/W)
- **FR-SOC-012** The system shall render user and school profiles with their posts, photos, and details. (M/W)

## Module: Discovery (FR-DISC)

- **FR-DISC-001** The system shall list schools for the user to browse and follow. (M/W)
- **FR-DISC-002** The system shall list users (teachers/friends) to browse, follow, or request. (M/W)

## Module: E-Schooling Status & Verification (FR-VER)

- **FR-VER-001** The system shall let a user declare/manage an academic status (student/parent/teacher/principal). (M/W)
- **FR-VER-002** The system shall let parents add one or more children, each with school/medium/class/section. (M/W)
- **FR-VER-003** The system shall maintain a "currently selected child" that scopes a parent's academic views. (M)
- **FR-VER-004** The system shall let a user submit a verification request to a school for a specific class/role. (M/W)
- **FR-VER-005** The system shall mark a member unverified (`VERIFIED_* = false`) until a school approves. (M/W)
- **FR-VER-006** The system shall let a school approve or reject verification requests per class and role. (W)
- **FR-VER-007** The system shall grant access to class academic data only to verified members. (M/W)
- **FR-VER-008** The system shall let a school view verified members grouped by role/subject/class. (W)
- **FR-VER-009** The system shall let a school manually add or remove members. (W)
- **FR-VER-010** The system shall let a school allocate a verified teacher as a class teacher. (W)

## Module: Projects & Homeworks (FR-HW)

- **FR-HW-001** The system shall let a teacher publish work of type Daily Homework, Assignment, or Project to a subject of a class. (M/W)
- **FR-HW-002** The system shall allow an optional image and a due date on published work. (M/W)
- **FR-HW-003** The system shall send a push notification to the class's parents when work is published. (M)
- **FR-HW-004** The system shall let students/parents view work grouped by subject and type. (M/W)
- **FR-HW-005** The system shall record which users have viewed each item (`VIEWED_BY`). (M/W)
- **FR-HW-006** The system shall badge unviewed work counts for students/parents. (M)

## Module: Notice Board (FR-NB)

- **FR-NB-001** The system shall let a school/principal publish notices to the school community. (M/W)
- **FR-NB-002** The system shall display notices newest-first. (M/W)
- **FR-NB-003** The system shall record notice read state and badge unread notices. (M/W)

## Module: Timetable (FR-TT)

- **FR-TT-001** The system shall let a school upload a timetable (image) per class. (W)
- **FR-TT-002** The system shall let members of a class view its timetable. (M/W)

## Module: Syllabus Covered (FR-SYL)

- **FR-SYL-001** The system shall let teachers/school record syllabus coverage per class/subject. (M/W)
- **FR-SYL-002** The system shall let members view syllabus coverage. (M/W)

## Module: Leave Application (FR-LV)

- **FR-LV-001** The system shall let parents (for a child) and teachers submit leave applications. (M/W)
- **FR-LV-002** The system shall route student/parent leave to the class teacher's received queue. (M/W)
- **FR-LV-003** The system shall route teacher leave to the principal's received queue. (M/W)
- **FR-LV-004** The system shall let approvers accept or reject applications, moving them to accepted/rejected. (M/W)
- **FR-LV-005** The system shall badge the count of received applications for approvers. (M)
- **FR-LV-006** The system shall hide the leave module from students. (M)
- **FR-LV-007** The system shall keep each applicant's leave history. (M/W)

## Module: Complaints & Feedback (FR-CF)

- **FR-CF-001** The system shall let members submit complaints and suggestions to a school. (M/W)
- **FR-CF-002** The system shall let a school/principal review complaints and suggestions grouped by class/sender. (M/W)
- **FR-CF-003** The system shall hide the complaints module from students. (M)

## Module: Events (FR-EV)

- **FR-EV-001** The system shall let a school create and manage upcoming events. (W)
- **FR-EV-002** The system shall display events to members and followers. (M/W)

## Module: Notifications (FR-NOTIF)

- **FR-NOTIF-001** The system shall deliver push notifications to relevant users for new homework/assignments/projects. (M)
- **FR-NOTIF-002** The system shall deep-link a homework notification tap to the Projects & Homeworks screen. (M)
- **FR-NOTIF-003** The system shall present live in-app badges for messages, requests, notices, homework, and leave. (M/W)

## Module: Media (FR-MED)

- **FR-MED-001** The system shall let users upload a profile picture. (M/W)
- **FR-MED-002** The system shall let users attach images to posts and homework. (M/W)
- **FR-MED-003** The system shall let schools upload timetable images. (W)

## Module: Monetisation (FR-MON)

- **FR-MON-001** The system shall display banner advertising in the mobile app. (M)
- **FR-MON-002** _(Planned)_ The system shall provide a subscription mechanism for schools. — **Not implemented** (stub only). (W)
