# 08 — User Journeys

End-to-end workflows, derived from navigation flows and Firestore writes.

---

## J1. New individual user — discovery to first use (Mobile)

1. **Discover & install** the ConnectEdApp Android app.
2. **Onboarding** carousel on first launch → Login screen.
3. **Register** → enter personal details (name, email, mobile, gender, DOB, password) → choose a **status**: Student / Parent / Teacher / User.
4. Provide **role-specific details**:
   - *Student:* select school, medium, class, section.
   - *Parent:* add a child (school, medium, class, section).
   - *Teacher:* select school, subjects taught.
   - *User:* nothing further (social only).
5. Account is created (Firebase Auth + `USERS` doc); an **Expo push token** is stored.
6. If an academic status was chosen, a **verification request** is submitted to the school; status shows **Pending**.
7. User lands on the app: general users go to **Social**; academic users go to **Projects & Homeworks** (drawer home).

---

## J2. School onboarding (Website)

1. School visits the website → **Create School Account**.
2. Enter **school identity** (name, address hierarchy, affiliation, contact, mission/vision, facilities).
3. Configure **academic structure**: choose mediums (English/Hindi), classes (Pre-Nursery…Class 12), sections (A–E), and **subjects per class**.
4. Account created (`SCHOOLS` doc + nested class docs).
5. School lands on its **portal** (`/schoolaccountprofile`).
6. School begins **verifying** incoming member requests and publishing content.

---

## J3. Verification handshake (cross-platform)

1. User self-declares a status and **submits a verification request** (writes `VERIFIED_* = false` on their side + a request doc under the school's class `VERIFICATION_REQUESTS`).
2. School opens **Verification Requests**, reviews the request (Student/Parent/Teacher/Principal), and **approves** (or rejects).
3. On approval, the member moves to **Verified Members**; `VERIFIED_* = true`.
4. The now-verified user gains access to **class academic data** (homework, notices, timetable, syllabus, leave, complaints scoped to that class/school).

*(For teachers, the school additionally allocates subjects and, optionally, class-teacher status.)*

---

## J4. Teacher publishes homework (Mobile/Web)

1. Teacher opens **Projects & Homeworks**, selects a **subject** they teach.
2. Chooses **work type** — Daily Homework, Assignment, or Project.
3. Adds a description, optional **image**, and **due date**; publishes.
4. Work is written under the class's `PROJECTS_&_HOMEWORKS/{subject}/{type}` and a **push notification** is sent to the class's parents.
5. Students/parents see a **badge**; opening the item marks it in `VIEWED_BY`.

---

## J5. Parent tracks a child (Mobile)

1. Parent opens the app; the app scopes everything to the **currently selected child** (`CURRENT_SELECTED_CHILD`).
2. Parent switches child if they have more than one.
3. Views the child's **Homework**, **Notice Board**, **Timetable**, **Syllabus Covered**.
4. Submits a **Leave Application** for the child → routed to the class teacher.
5. Optionally files a **Complaint/Suggestion** to the school.

---

## J6. Leave approval chains

**Student/Parent leave → Class Teacher**
1. Parent submits leave → lands in class `LEAVE_APPLICATION/RECIEVED`.
2. Class teacher sees a **badge**, opens the application, **Accepts** or **Rejects** → moves to `ACCEPTED`/`REJECTED`.

**Teacher leave → Principal**
1. Teacher submits leave → lands in `ALL_TEACHERS/LEAVE_APPLICATIONS/.../RECIEVED`.
2. Principal sees a **badge**, **Accepts** or **Rejects**.

---

## J7. Social engagement (any user)

1. **Find Schools / Find Friends** → follow schools, send connection requests.
2. Requests appear in the recipient's **Connections** (badge); recipient **accepts** → mutual connection.
3. **Create Post** (text + image) → appears in followers' **feeds**.
4. Others **like** and **comment**.
5. **Message** a connection privately; unread messages badge the Messages tab.

---

## J8. School broadcasts (Website)

1. School posts a **Notice** → all members' notice boards update (unread badges).
2. School creates an **Upcoming Event** → visible to members/followers.
3. School uploads a **Timetable** image per class.
4. School/teachers update **Syllabus Covered**.

---

## J9. Returning-user daily loop

1. Open app → see badges (unread homework, notices, messages, requests, received leave).
2. Clear academic badges (read homework/notices).
3. Respond to messages/requests.
4. Teachers publish; parents/students consume; principals/class teachers approve leave.
