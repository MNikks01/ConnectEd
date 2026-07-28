# 07 — Screen Documentation

This documents the screens (mobile) and pages (web). For readability, screens are grouped by module. Each entry gives **Purpose**, **Actions**, **Displayed info**, **Navigation**, and **Dependencies**. Where a screen exists on both platforms the behaviour is equivalent unless noted.

> **Shared functionalities note:** Feed, profiles, posting, likes/comments, follow, friends/connections, messaging, find schools/friends, e-schooling status, and all academic modules (homework, notices, timetable, syllabus, leave, complaints) exist on **both** mobile and web. Onboarding, push notifications and ads are **mobile-only**; school administration (verification, verified members, add/remove, class-teacher allocation, school profile management, event creation, timetable upload) is **web-only**.

---

## A. Authentication screens

### Onboarding (M — `OnboardingScreen`)
- **Purpose:** First-run introduction.
- **Actions:** Swipe through slides, Skip/Done → Login.
- **Displayed:** Marketing slides.
- **Navigation:** → Login. Shown only on first launch.
- **Dependencies:** AsyncStorage flag.

### Login (M — `LoginScreen`; W — `Login`)
- **Purpose:** Authenticate existing accounts.
- **Actions:** Enter email + password (visibility toggle), sign in, go to Register/Create account.
- **Displayed:** Email/password fields, errors, links.
- **Navigation:** On success → Home (users) / School portal (school, web). Mobile rejects school UIDs. Web routes school→`/schoolaccountprofile`, user→`/user`.
- **Dependencies:** Firebase Auth; Firestore lookup to classify account.

### Register User (M — `RegisterUserScreen`; W — `CreateNewAccount`)
- **Purpose:** Create an individual account.
- **Actions:** Fill personal info → choose status (Student/Parent/Teacher/User) → fill role-specific details → submit.
- **Displayed:** Multi-block form; validation messages (email format, min-8 password, password match).
- **Navigation:** → profile/home on success.
- **Dependencies:** Auth, Firestore `USERS`, Storage, Expo push token.

### Create School Account (W — `CreateSchoolAccountSchoolDetails` → `CreateSchoolAccount`)
- **Purpose:** Institutional onboarding.
- **Actions:** Enter school identity → select mediums/classes/sections → set subjects per class → submit.
- **Displayed:** School detail form; class/section/medium selectors; subject inputs; guidance examples.
- **Navigation:** → school portal.
- **Dependencies:** Auth, Firestore `SCHOOLS` + class structure, Storage.

---

## B. Social screens

### Home / Feed (M — `HomepageScreen`/`HomeStack`; W — `MainHomePage`)
- **Purpose:** Consume the community feed.
- **Actions:** Scroll posts, like, comment, open profiles, open post sender.
- **Displayed:** Aggregated posts (followed schools + users), each with author, media, likes, comments; role-specific sidebar (web).
- **Navigation:** → Post detail, → Profiles; drawer/tabs to other modules.
- **Dependencies:** Following graph, `POSTS`.

### Create Post (M — `CreatePost`; W — post sender component)
- **Purpose:** Publish an update.
- **Actions:** Enter text, pick image(s), publish.
- **Displayed:** Composer.
- **Dependencies:** Storage `/Timeline`, Firestore `POSTS`.

### User Profile (M — `UsersProfileScreen`/`AccountScreen`; W — `UserProfile`)
- **Purpose:** View/manage own identity.
- **Actions:** Edit profile, view posts/photos/friends, view about (qualifications, bio, achievements).
- **Displayed:** Display picture, bio, achievements, qualification (degree, specialization, university, passout year), DOB, gender, posts, photos, friends list.
- **Navigation:** → Edit profile, → Followers/Following, → Friends.
- **Dependencies:** `USERS`, Storage.

### Friend / Other-user Profile (M — `FriendsProfileScreen`/`UsersProfileScreen`; W — `FriendsProfile`)
- **Purpose:** View another user.
- **Actions:** Follow/unfollow, send connection request, message, view posts.
- **Dependencies:** requests/connections, `POSTS`.

### School Profile (M — `SchoolsProfileScreen`/`SchoolAbout`; W — `SchoolAccountProfile`/`SchoolFriendProfile`)
- **Purpose:** View a school's public presence.
- **Actions:** Follow, view about/mission/vision/facilities/achievements, teachers list, events, posts.
- **Dependencies:** `SCHOOLS`, Storage.

### Followers / Following (M — `FollowersHP`/`FollowingsHP`; also `FriendsHP`)
- **Purpose:** List a user's follower/following/friend sets.
- **Actions:** Open profiles, follow/unfollow.
- **Dependencies:** followers/following collections.

### Messages (M — `MessagesScreen`; W — `AllMessages`)
- **Purpose:** Private conversations.
- **Actions:** Open a conversation, send messages, mark read.
- **Displayed:** Conversation list with unread indicators; message thread.
- **Dependencies:** `MESSAGES_SENT`/`MESSAGES_RECIEVED`.

---

## C. Discovery screens

### Find Schools (M — `FindSchools`; W — `FindToFollow` › Schools)
- **Purpose:** Discover/follow schools.
- **Actions:** Browse, follow, open profile.
- **Dependencies:** `SCHOOLS`.

### Find Friends (M — `FindFriends`; W — `FindToFollow` › Teachers & Friends / Accounts)
- **Purpose:** Discover/connect with users.
- **Actions:** Browse, follow, send request.
- **Dependencies:** `USERS`.

---

## D. E-Schooling status screens

### E-Schooling Status (M — `ESchoolingStatusScreen`; W — `SidebarESchoolingStatus`)
- **Purpose:** Declare and manage academic roles.
- **Actions:** Add status (Student/Parent/Teacher/Principal), add child (parent), select school/class/subjects, submit verification request, view current status & verification state.
- **Displayed:** Current status, verification status (pending/verified), children list, subjects taught.
- **Navigation:** → verification request forms.
- **Dependencies:** `E-SCHOOLING_INFO` subtree, `SCHOOLS`.

---

## E. Academic screens

### Projects & Homeworks (M — `ProjectsAndHWs` + `HWStack`; W — `SidebarHomeWorks`)
- **Purpose:** Distribute/consume academic work.
- **Actions (teacher):** Select subject → choose work type (Daily Homework/Assignment/Project) → add description, image, due date → publish (sends push).
- **Actions (student/parent):** Browse by subject and type; opening marks as viewed.
- **Displayed:** Work items grouped by subject and type; due dates; unread badges.
- **Navigation:** Drilldown class → subject → type → item.
- **Dependencies:** class `PROJECTS_&_HOMEWORKS`, Storage `/Homeworks`, Expo push, `VIEWED_BY`.

### Notice Board (M — `NoticeBoard`; W — `SidebarNoticeBoard`/`UserNoticeBoard`)
- **Purpose:** School announcements.
- **Actions (school/principal):** Post notice. **(members):** Read (marks viewed).
- **Displayed:** Notices newest-first; unread badge.
- **Dependencies:** `NOTICE_BOARD/NOTICES_SENT`, `VIEWED_BY`.

### Timetable (M — `Timetable` + `TimetableStack`; W — `SchoolTimeTable`)
- **Purpose:** Publish/view class schedule.
- **Actions (school):** Upload timetable image per class. **(members):** View.
- **Dependencies:** Storage `/Timetable`, class subtree.

### Syllabus Covered (M — `SyllabusCovered` + stack; W — `SchoolSyllabusCovered`)
- **Purpose:** Track curriculum progress.
- **Actions (teacher/school):** Record covered syllabus per subject. **(others):** View.
- **Dependencies:** class subject subtree.

### Leave Application (M — `LeaveApplication` + `LeaveStack`; W — `SchoolLeaveApplications`)
- **Purpose:** Leave request workflow.
- **Actions (parent/teacher):** Submit application (dates, reason). **(class teacher):** Approve/reject student & parent leave. **(principal):** Approve/reject teacher leave.
- **Displayed:** Received / Accepted / Rejected tabs; applicant's own history; received-count badge.
- **Navigation:** Role-specific sub-views (student/parent/teacher/principal).
- **Dependencies:** class & school leave collections, `CLASS_TEACHER_DATA`.

### Complaints & Feedback (M — `ComplaintsAndFeedback` + `ComplaintStack`; W — `SchoolComplaints`)
- **Purpose:** Grievances/suggestions to school.
- **Actions:** Submit complaint or suggestion; school/principal reviews (accordion by class/sender type).
- **Dependencies:** `COMPLAINTS_AND_SUGGESTIONS`.

### Upcoming Events (W — `SchoolUpcomingEvents`; M — view within school profile)
- **Purpose:** Publicise events.
- **Actions (school):** Create/manage events. **(members/followers):** View.
- **Dependencies:** `SCHOOL_EVENTS/ALL_EVENTS`.

---

## F. School administration pages (W only)

### Verification Requests (`SchoolVerificationRequests`)
- **Purpose:** Approve/reject membership requests.
- **Actions:** Review per class; approve/reject Students, Parents (+child), Teaching Staff (+subjects), Principal.
- **Displayed:** Pending requests grouped by class and type.
- **Dependencies:** class `VERIFICATION_REQUESTS`.

### Verified Members (`SchoolVerifiedMembers`)
- **Purpose:** Manage confirmed members.
- **Actions:** Browse verified Students/Parents/Teachers (by subject)/Principal.
- **Dependencies:** class `VERIFIED_MEMBERS`.

### Add or Remove (`SchoolAddOrRemove`)
- **Purpose:** Manual membership adjustments.
- **Actions:** Add/remove members.

### Class Teacher Allocation (`ClassTeacherAllocate`)
- **Purpose:** Assign class teachers.
- **Actions:** Select a verified teacher → allocate to a class (`CLASS_TEACHER_DATA`).

### School Self Profile (`SchoolAccountProfile`)
- **Purpose:** Manage school's public presence.
- **Actions:** Edit about/mission/vision/facilities/achievements, post, manage photos, view followers/following, teacher list.

---

## G. Support pages

### How To Use (M — `HowToUse` + several `HowTo*` components; W — `HowToUse`)
- **Purpose:** Explain features.
- **Displayed:** Guides for verification requests, verified members, add/remove, events, notice board, projects & homework, e-schooling status.

### Subscription (W — `Subscription`) — **placeholder**
- Renders header + "Subscription" text only. No functionality. See [Missing Features](./16-missing-features.md).
