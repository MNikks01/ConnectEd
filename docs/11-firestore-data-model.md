# 11 — Firestore Data Model

Reconstructed from the Firestore query/write paths and field names used across both apps. Two root collections exist: **`USERS`** and **`SCHOOLS`**.

> **Path convention:** Each entity's display name is used as an intermediate path segment. A user's subtree lives under `USERS/{uid}/{USER_NAME}/…` and a school's under `SCHOOLS/{uid}/{SCHOOL_NAME}/…` (referred to in code as `USER_PATH_COLLECTION` / `SCHOOL_PATH_COLLECTION`). In the trees below this segment is written as `{name}`.
>
> **Class key:** Academic data is stored under a single key encoding **Medium + Class + Section**, e.g. `EngClass5SecA` (English Medium, Class 5, Section A). Written below as `{classKey}`.

---

## 11.1 `USERS` collection

### `USERS/{uid}` (document) — core user profile
Key fields observed:
- `USER_ID`, `USER_NAME` (handle used as path segment), `USER_FULL_NAME`, `USER_EMAIL_ID`, `USER_MOB_NO`
- `USER_GENDER`, `USER_DOB`, `USER_CREATED_ON`
- `USER_CURRENT_STATUS` — one of `STUDENT` · `PARENT` · `TEACHER` · `PRINCIPAL` · *(empty/undefined for a general "User")*
- `USER_STATUS`, `USER_DISPLAY_PIC`, `USER_BIO`, `USER_ACHIEVEMENTS`
- Qualifications: `USER_QUAL_DEGREE` / `USER_DEGREE_`, `USER_QUAL_SPECIALIZATION`, `USER_QUAL_UNIVERSITY`, `USER_QUAL_PASSOUT_YEAR`
- `USER_SCHOOL_ID` (linked school, for academic roles)
- `USER_PATH_COLLECTION` (= `USER_NAME`)
- `PUSH_NOTIFICATION` (Expo push token)
- `USER_PWD` ⚠️ (plaintext password — see Missing Features)

### `USERS/{uid}/{name}/…` subcollections & docs

| Path | Purpose |
|---|---|
| `POSTS/ALL_POSTS/{postId}` | User's timeline posts |
| `…/{postId}/POST_LIKES/{likeId}` | Likes on a post |
| `…/{postId}/POST_COMMENTS/{commentId}` | Comments on a post |
| `FOLLOWING/FOLLOWING_USERS`, `FOLLOWING/FOLLOWING_SCHOOLS` | Who this user follows |
| `FOLLOWERS/FOLLOWER_USERS`, `FOLLOWERS/FOLLOWER_SCHOOLS` | Who follows this user |
| `REQUESTS_SENT/REQUESTS_SENT_IDs`, `REQUESTS_RECIEVED/REQUESTS_RECIEVED_IDs` | Connection requests |
| `CONNECTIONS/CONNECTED_USERS` | Confirmed friends |
| `MESSAGES_SENT/MESSAGES`, `MESSAGES_RECIEVED/MESSAGES` | Direct messages (each has `IS_VIEWED`) |
| `COMPLAINTS_AND_SUGGESTIONS/COMPLAINTS`, `…/SUGGESTIONS` | Complaints/suggestions the user filed |

### `USERS/{uid}/{name}/E-SCHOOLING_INFO/…` — role data
| Role | Path | Notable content |
|---|---|---|
| Teacher | `IS_TEACHER/VERIFICATION_DETAILS` | `VERIFIED_TEACHER`, `USER_SCHOOL_ID` |
| Teacher | `IS_TEACHER/IS_TEACHER_DATA/SUBJECTS_TEACH/{sub}` | Subjects taught |
| Teacher | `IS_TEACHER/CLASS_TEACHER_DATA` | `MEDIUM`, `CLASSNUM`, `SECTION` (class-teacher allocation) |
| Teacher | `IS_TEACHER/IS_TEACHER_DATA/LEAVE_APPLICATIONS` | Teacher's own leave history |
| Principal | `IS_PRINCIPAL/VERIFICATION_DETAILS` | `VERIFIED_PRINCIPAL`, `USER_SCHOOL_ID` |
| Student | `IS_STUDENT/VERIFICATION_DETAILS` | `VERIFIED_STUDENT`, `USER_SCHOOL_ID` |
| Parent | `IS_PARENT/IS_PARENT_DATA` | `CURRENT_SELECTED_CHILD` |
| Parent | `IS_PARENT/IS_PARENT_DATA/CHILDS_INFO/{childId}` | `CHILDS_SCHOOL_ID`, `CHILDS_MEDIUM`, `CHILDS_CLASS`, `CHILDS_SECTION` |
| Parent | `IS_PARENT/IS_PARENT_DATA/CHILDS_INFO/{childId}/LEAVE_APPLICATIONS` | Child's leave history |

---

## 11.2 `SCHOOLS` collection

### `SCHOOLS/{uid}` (document) — school profile
Key fields:
- Identity: `SCHOOL_ID`, `SCHOOL_NAME` (path segment), `SCHOOL_FULL_NAME`, `SCHOOL_ADMIN_NAME`, `SCHOOL_CREATED_ON`
- Contact: `SCHOOL_EMAIL`, `SCHOOL_PHONE_NO`
- Address: `SCHOOL_ADDRESS`, `SCHOOL_ADDRESS_LINE`, `SCHOOL_REST_ADDRESS`, `SCHOOL_VILLAGE`, `SCHOOL_TEHSIL`, `SCHOOL_DISTRICT`, `SCHOOL_CITY`, `SCHOOL_STATE`, `SCHOOL_PINCODE`
- Profile: `SCHOOL_ABOUT`, `SCHOOL_MISSION`, `SCHOOL_VISION`, `SCHOOL_FACILITIES`, `SCHOOL_ACHIEVEMENTS`, `SCHOOL_ESTABLISHMENT`, `SCHOOL_AFFILIATION`
- `SCHOOL_PATH_COLLECTION` (= `SCHOOL_NAME`)
- `SCHOOL_PASSWORD` ⚠️ (plaintext — see Missing Features)

### `SCHOOLS/{uid}/{name}/…` — school-owned data

| Path | Purpose |
|---|---|
| `POSTS/ALL_POSTS/{postId}` (+ `POST_LIKES`, `POST_COMMENTS`) | School's timeline posts |
| `MESSAGES_RECIEVED/MESSAGES` | School inbox |
| `NOTICE_BOARD/NOTICES_SENT/{noticeId}` | Notices (`NOTICE_TIMESTAMP`, `VIEWED_BY[]`) |
| `SCHOOL_EVENTS/ALL_EVENTS/{eventId}` | Upcoming events |
| `ALL_TEACHERS/ALL_TEACHERS_LIST` | Roster of teachers |
| `ALL_TEACHERS/LEAVE_APPLICATIONS/ALL_LEAVE_APPLICATIONS/{RECIEVED\|ACCEPTED\|REJECTED}` | Teacher-leave queues (principal-managed) |
| `COMPLAINTS_AND_SUGGESTIONS/COMPLAINTS`, `…/SUGGESTIONS` | Complaints/suggestions to the school |

### `SCHOOLS/{uid}/{name}/CLASSES_DETAILS/CLASSES/{classKey}/…` — per-class academic data

| Path | Purpose |
|---|---|
| *(class doc)* | `SUBJECTS_LIST` and class metadata |
| `PROJECTS_&_HOMEWORKS/{subject}/ASSIGNMENT/{id}` | Assignments (`VIEWED_BY[]`, due date, image) |
| `PROJECTS_&_HOMEWORKS/{subject}/HOMEWORK/{id}` | Daily homework |
| `PROJECTS_&_HOMEWORKS/{subject}/PROJECT/{id}` | Projects |
| `STUDENTS/VERIFICATION_REQUESTS/VERIFICATION_REQUESTS_DATA/{uid}` | Pending student join requests |
| `PARENTS/VERIFIED_MEMBERS/VERIFIED_MEMBERS_DATA/{uid}` | Verified parents of the class |
| `LEAVE_APPLICATION/{RECIEVED\|ACCEPTED\|REJECTED}/…_APPLICATIONS/{id}` | Student/parent leave queues (class-teacher-managed) |

*(Analogous `VERIFICATION_REQUESTS` / `VERIFIED_MEMBERS` paths exist for teachers and principal, split by subject where relevant.)*

---

## 11.3 Entity relationships

```
USER ──(USER_CURRENT_STATUS)── one of: Student / Parent / Teacher / Principal / (User)
USER ──USER_SCHOOL_ID──▶ SCHOOL              (academic roles link to one school)
PARENT ──CHILDS_INFO──▶ CHILD ──CHILDS_SCHOOL_ID──▶ SCHOOL
SCHOOL ──CLASSES_DETAILS/CLASSES──▶ CLASS(classKey) ──SUBJECTS_LIST──▶ SUBJECT
TEACHER ──SUBJECTS_TEACH──▶ SUBJECT ; ──CLASS_TEACHER_DATA──▶ one CLASS
CLASS ──PROJECTS_&_HOMEWORKS/{subject}──▶ Homework / Assignment / Project
CLASS ──STUDENTS/PARENTS──▶ VERIFICATION_REQUESTS → VERIFIED_MEMBERS
CLASS ──LEAVE_APPLICATION──▶ Received → Accepted / Rejected

Social graph (users & schools):
USER/SCHOOL ──POSTS──▶ Post ──▶ Likes, Comments
USER ──FOLLOWING / FOLLOWERS──▶ USER & SCHOOL
USER ──REQUESTS_SENT/RECIEVED──▶ CONNECTIONS (mutual)
USER/SCHOOL ──MESSAGES_SENT/RECIEVED──▶ USER/SCHOOL
```

## 11.4 Data ownership

| Data | Owner (who can write) | Consumers (read) |
|---|---|---|
| User profile & social subtree | The user | Followers/friends |
| School profile & class structure | The school | Members, followers |
| Homework/Assignments/Projects | Teachers (of the class/subject) | Students, parents, principal |
| Notices, Events, Timetable | School / principal | Members, followers |
| Syllabus coverage | Teachers / school | Members |
| Verification requests | The requesting user (create) + school (resolve) | School |
| Leave applications | Applicant (create) + approver (resolve) | Applicant, approver |
| Complaints/Suggestions | Member (create) | School / principal / teachers |
| Messages | Both participants | Both participants |

> **Assumption:** "Owner" here reflects the intended writer inferred from which screen performs the write; because no security rules exist, the database does not technically enforce this ownership.

## 11.5 Notable modelling observations

- **Name-as-path-segment** makes documents brittle: renaming a user/school would orphan the subtree. Read state and ownership rely on array fields like `VIEWED_BY[]`.
- **Class taxonomy is enumerated** in a large constant (`ClsMedSec.js` / `FunctionClsStr.js`) mapping (medium, class, section) → key. Supported classes: Pre-Nursery, Nursery, KG-1, KG-2, Class 1–12; sections A–E; mediums English & Hindi.
- **Denormalised fan-out**: publishing homework writes to the class subtree and separately pushes to collected tokens — all client-side, with no transactional guarantee.
