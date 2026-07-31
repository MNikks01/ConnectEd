# 04 — Feature Catalog

Features are grouped by module. Each entry lists **Purpose**, **Description**, **Primary users**, and **Dependencies**. "M" = available on Mobile, "W" = available on Website.

---

## Module A — Authentication & Onboarding

### A1. Onboarding walkthrough (M)

- **Purpose:** Introduce a first-time user to the product.
- **Description:** A swipeable onboarding carousel shown only on first launch (tracked via a device flag `ConnectEdAppLaunched` in AsyncStorage). Subsequent launches go straight to Login.
- **Primary users:** All new mobile users.
- **Dependencies:** Local device storage.

### A2. User registration (M, W)

- **Purpose:** Create an individual account.
- **Description:** Multi-step form collecting name, email, mobile, gender, date of birth, password (min 8 chars, confirmed), then a **status choice**: Student, Parent, Teacher, or User. Role-specific detail forms follow (child/school/subject/qualification data). Creates a Firebase Auth account and a `USERS` document. Captures an Expo push token at sign-up.
- **Primary users:** Students, parents, teachers, general users.
- **Dependencies:** Firebase Auth, Firestore `USERS`, Expo notifications, Firebase Storage (profile picture).

### A3. School registration (W only)

- **Purpose:** Create an institutional school account.
- **Description:** Multi-step web wizard: school details (name, address hierarchy, affiliation, contact, mission/vision) → class configuration (select mediums, classes, sections, and per-class subjects). Creates a `SCHOOLS` document and the nested class structure.
- **Primary users:** School administrators.
- **Dependencies:** Firebase Auth, Firestore `SCHOOLS`, Storage.

### A4. Login (M, W)

- **Purpose:** Authenticate.
- **Description:** Email/password sign-in. On web, the app checks whether the UID is a school or a user and routes accordingly. On mobile, if the UID belongs to a school it is rejected ("login from desktop").
- **Primary users:** All.
- **Dependencies:** Firebase Auth, Firestore.

### A5. Password reset (M)

- **Purpose:** Recover access.
- **Description:** Password-visibility toggles and reset helpers exist (`Password/` utilities). **Assumption:** a "forgot password" via Firebase email reset is intended; only visibility-toggle helpers are confirmed in code.
- **Dependencies:** Firebase Auth.

---

## Module B — Social Network

### B1. Timeline posts (M, W)

- **Purpose:** Let users and schools broadcast updates.
- **Description:** Create a post with text and image(s); posts stored under the author's `POSTS/ALL_POSTS`. Feed aggregates posts from followed schools and users.
- **Primary users:** All users and schools.
- **Dependencies:** Firestore `POSTS`, Storage (`/Timeline`), following graph.

### B2. Likes (M, W)

- **Purpose:** Lightweight engagement.
- **Description:** Users like posts; likes stored in `POST_LIKES` subcollection.
- **Dependencies:** B1.

### B3. Comments (M, W)

- **Purpose:** Conversation on posts.
- **Description:** Users comment on posts; stored in `POST_COMMENTS`.
- **Dependencies:** B1.

### B4. Follow schools & users (M, W)

- **Purpose:** Subscribe to content.
- **Description:** Follow/unfollow schools and users. Maintained as `FOLLOWING_SCHOOLS`, `FOLLOWING_USERS`, `FOLLOWER_SCHOOLS`, `FOLLOWER_USERS`. Feeds are built from these.
- **Dependencies:** Firestore following/followers collections.

### B5. Friends / Connections (M, W)

- **Purpose:** Mutual peer relationships.
- **Description:** Send/receive connection requests (`REQUESTS_SENT`, `REQUESTS_RECIEVED`), accept to form a `CONNECTIONS/CONNECTED_USERS` link. Badge shows pending received requests.
- **Dependencies:** Firestore requests & connections collections.

### B6. Private messaging (M, W)

- **Purpose:** 1:1 direct communication.
- **Description:** Users exchange messages; each side keeps `MESSAGES_SENT` and `MESSAGES_RECIEVED`. Unread state (`IS_VIEWED`) drives an unread badge.
- **Primary users:** All users; schools also have a message inbox.
- **Dependencies:** Firestore messages collections.

### B7. Profiles (M, W)

- **Purpose:** Public identity.
- **Description:** User profile (bio, achievements, qualifications, DOB, gender, display picture, photos, friends) and School profile (about, mission, vision, facilities, achievements, teachers list, events). Friend/other-user profiles are viewable.
- **Dependencies:** Firestore `USERS`/`SCHOOLS`, Storage.

---

## Module C — Discovery / Search

### C1. Find Schools (M, W)

- **Purpose:** Discover and follow schools.
- **Description:** Browse the `SCHOOLS` collection; follow a school; open its profile.
- **Dependencies:** Firestore `SCHOOLS`, following graph.

### C2. Find Friends / Find to Follow (M, W)

- **Purpose:** Discover people to connect with or follow.
- **Description:** Browse users (teachers, friends), send connection requests or follow. Web splits this into "Accounts / Schools / Teachers & Friends" tabs.
- **Dependencies:** Firestore `USERS`.

---

## Module D — E-Schooling Status (role & verification management)

### D1. Declare / manage academic status (M, W)

- **Purpose:** Let a user become a student/parent/teacher/principal.
- **Description:** The "E-Schooling Status" area lets a user add or view their status. Parents add children; teachers add subjects/school; students/principals select their school & class.
- **Primary users:** Students, parents, teachers, principals.
- **Dependencies:** Firestore `E-SCHOOLING_INFO` subtree.

### D2. Submit verification request (M, W)

- **Purpose:** Ask a school to confirm identity/role.
- **Description:** Creates a `VERIFICATION_DETAILS` record on the user side (`VERIFIED_* = false`) and a request document under the school's class (`VERIFICATION_REQUESTS`). Until verified, the user cannot access class academic data.
- **Dependencies:** Firestore `SCHOOLS` class subtree, `USERS` e-schooling subtree.

### D3. Child management (parents) (M, W)

- **Purpose:** Manage multiple children.
- **Description:** Parents add children (`CHILDS_INFO`), each with school/medium/class/section; select a "current child" (`CURRENT_SELECTED_CHILD`) that scopes all academic views.
- **Dependencies:** D1, Firestore parent subtree.

---

## Module E — Academics (school-managed, per class)

> A "class" = Medium + Class + Section (e.g. `EngClass5SecA`). All academic content lives under `SCHOOLS/{id}/{schoolName}/CLASSES_DETAILS/CLASSES/{classKey}/…`.

### E1. Projects & Homeworks (M, W)

- **Purpose:** Distribute academic work.
- **Description:** Teachers publish three work types — **Daily Homework**, **Assignment**, **Project** — to a specific subject of a specific class, with optional image and due date. Students/parents view them, and read state is tracked (`VIEWED_BY`). Publishing triggers a **push notification** to the class's parents. Unread counts appear as badges.
- **Primary users:** Teachers (publish); students, parents (consume); principal (view).
- **Dependencies:** Firestore class `PROJECTS_&_HOMEWORKS/{subject}/{ASSIGNMENT|HOMEWORK|PROJECT}`, Storage (`/Homeworks`), Expo push.

### E2. Notice Board (M, W)

- **Purpose:** School-wide announcements.
- **Description:** School/principal posts notices to `NOTICE_BOARD/NOTICES_SENT`, ordered by timestamp. Members see them; read state tracked via `VIEWED_BY`; unread badge shown.
- **Primary users:** School/principal (post); all verified members (read).
- **Dependencies:** Firestore school `NOTICE_BOARD`.

### E3. Timetable (M, W)

- **Purpose:** Publish class schedules.
- **Description:** School uploads a timetable per class (stored as an image in Storage `SCHOOLS/{id}/Timetable/{classKey}`). Students, parents, teachers, principals view it.
- **Primary users:** School (upload); members (view).
- **Dependencies:** Storage, Firestore class subtree.

### E4. Syllabus Covered (M, W)

- **Purpose:** Track curriculum progress.
- **Description:** Per class + subject, teachers/school record how much syllabus has been covered; students/parents/principals view progress.
- **Primary users:** Teachers/school (update); students, parents, principal (view).
- **Dependencies:** Firestore class subject subtree.

### E5. Leave Application (M, W)

- **Purpose:** Formal leave workflow.
- **Description:** Two chains:
  - **Student/Parent → Class Teacher:** application lands in the class's `LEAVE_APPLICATION/RECIEVED`; class teacher moves it to `ACCEPTED` or `REJECTED`.
  - **Teacher → Principal:** application lands in `ALL_TEACHERS/LEAVE_APPLICATIONS/.../RECIEVED`; principal accepts/rejects.
    Applicants keep their own `LEAVE_APPLICATIONS` history. Received counts show as badges.
    Students **cannot** apply (module hidden for them).
- **Primary users:** Parents, teachers (apply); class teachers, principal (approve).
- **Dependencies:** Firestore class & school leave collections, `CLASS_TEACHER_DATA`.

### E6. Complaints & Feedback (M, W)

- **Purpose:** Channel grievances/suggestions to the school.
- **Description:** Members submit **Complaints** and **Suggestions** stored under `COMPLAINTS_AND_SUGGESTIONS`. School/principal/teachers review. Hidden for students in the mobile drawer.
- **Primary users:** Parents, teachers (submit); school, principal (review).
- **Dependencies:** Firestore complaints/suggestions collections.

### E7. Upcoming Events (W publish, M view)

- **Purpose:** Publicise school events.
- **Description:** Schools create events (`SCHOOL_EVENTS/ALL_EVENTS`); members and followers view.
- **Primary users:** School (create); everyone (view).
- **Dependencies:** Firestore `SCHOOL_EVENTS`.

### E8. Class Teacher Allocation (W only)

- **Purpose:** Assign a teacher as class teacher.
- **Description:** School allocates a verified teacher to a class (`CLASS_TEACHER_DATA`), enabling that teacher to approve student/parent leave for the class.
- **Primary users:** School.
- **Dependencies:** Verified teachers, class structure.

---

## Module F — School Administration (W only)

### F1. Verification Requests management

- Review and approve/reject incoming student, parent, teacher, and principal requests per class.

### F2. Verified Members management

- View verified students, parents, teachers (by subject), and principal per class.

### F3. Add / Remove members

- Manually add or remove members from the school/class.

### F4. School profile management

- Maintain about, mission, vision, facilities, achievements, teacher list, photos.

_(All detailed in [Website Features](./05-website-features.md).)_

---

## Module G — Notifications

### G1. Push notifications (M)

- Expo push messages, e.g. new homework/assignment/project to a class's parents. See [Notifications](./13-notifications.md).

### G2. In-app badges (M, W)

- Live unread counters for messages, friend requests, unviewed notices, unviewed homework, and received leave applications.

---

## Module H — Monetisation

### H1. Banner advertising (M)

- Google Mobile Ads (AdMob) banner integration (`BannerAd/`, app id configured in `app.json`).

### H2. Subscription (W — placeholder)

- A `/subscription` route exists but renders only a stub. See [Missing Features](./16-missing-features.md).

---

## Module I — Help & Support

### I1. How To Use guides (M, W)

- In-app help explaining verification, notice board, events, projects & homework, add/remove, verified members, etc.

### I2. Complaints/Feedback to school (covered in E6).
