# 05 — Website (GetConnected) Functionalities

The website is the **school administration portal** and a **desktop client for individual users**. It is a React single-page app (routes in `src/App.js`) hosted on Firebase Hosting. School accounts can **only** operate here.

## 5.1 Website-exclusive functionality (not available on mobile)

These are the capabilities only the website offers, almost all belonging to the **School** account.

### School onboarding & structure
- **Create a school account** — `/createschoolaccount` → `/createschoolaccount/selectclasses`. A wizard captures school identity (name, full name, address hierarchy: address line, village, tehsil, district, state, pincode; establishment year, affiliation, admin name, contact email/phone, mission, vision, facilities, achievements) and then the **academic structure**: which **mediums** (English/Hindi), which **classes** (Pre-Nursery … Class 12), which **sections** (A–E), and the **subjects** per class.
- The wizard writes the `SCHOOLS/{uid}` document and the nested `CLASSES_DETAILS/CLASSES/{classKey}` documents with `SUBJECTS_LIST`.

### Membership verification & management
- **Verification Requests** (`/verificationrequests`) — approve/reject incoming requests, split by type: Students, Parents (and parent's child), Teaching Staff (and the subjects they claim), Principal.
- **Verified Members** (`/verifiedmembers`) — browse confirmed Students, Parents (+ child), Teachers (by subject), and Principal per class.
- **Add or Remove** (`/addorremove`) — manually add or remove members.
- **Class Teacher Allocation** (`/classteacher`) — assign a verified teacher as the class teacher of a class.

### Academic publishing & oversight (school/principal/teacher context on web)
- **Upcoming Events** (`/upcomingevents`) — create and manage school events.
- **School Timetable** (`/schooltimetable`) — upload/manage per-class timetables (image upload to Storage).
- **Syllabus Covered** (`/syllabuscovered`) — record and view syllabus progress per class/subject.
- **Projects & Homeworks** (`/projects&homeworks`) — publish and review homework/assignments/projects per class/subject.
- **Notice Board** (`/noticeboard`) — publish notices to the school community.
- **Leave Applications** (`/leaveapplications`) — school/principal view of the leave workflow (received/accepted/rejected).
- **Complaints** (`/schoolcomplaints`) — review complaints & suggestions, organised (accordion) by class/sender type.

### School social presence
- **School self-profile** (`/schoolsselfprofile`, `/schoolaccountprofile`) — manage the school's public profile, posts, photos, teacher list, following.
- **School friend profile** (`/schoolfriendprofile/:id`) — view another school/member profile from the school's perspective.

### Commercial
- **Subscription** (`/subscription`) — placeholder page (unimplemented — see [Missing Features](./16-missing-features.md)).

## 5.2 Individual-user functionality on the website

The website **also** serves individual users on desktop (login routes them to `/user`). Users get the desktop equivalents of the mobile experience:

- **Main Home / Feed** (`/`, `/user`) — aggregated posts from followed schools & users, with a role-appropriate sidebar (student/parent/teacher/principal/just-a-user variants).
- **User profile** (`/userprofile`) and **Friend profile** (`/friendsprofile/:id`) — profile, about, photos, friends.
- **Find to Follow** (`/findtofollow`) — discover accounts, schools, teachers & friends.
- **Messages** (`/messages`) — inbox and conversations.
- **E-Schooling Status** (`/eschoolingstatus`) — declare/manage status; add students/parents/teachers/principals; view current status; submit verification requests.
- **User Notice Board** (`/usernoticeboard`) — notices for the user's school/class.
- **Projects & Homeworks** (`/projects&homeworks`) — role-specific homework views (student, parent, teacher, principal).
- **Syllabus Covered**, **Timetable**, **Leave Applications**, **Complaints** — role-specific desktop views mirroring the mobile modules.
- **How To Use** (`/howtouse`) — help content.

## 5.3 Full website route map

| Route | Page | Primary audience |
|---|---|---|
| `/` , `/user` , `/schoolaccountprofile` | MainHomePage | User (feed) |
| `/loginpage` | Login | All |
| `/createuseraccount` | CreateNewAccount | New user |
| `/createschoolaccount` → `/createschoolaccount/selectclasses` | School creation wizard | New school |
| `/schoolsselfprofile` | SchoolAccountProfile | School |
| `/schoolfriendprofile/:id` | SchoolFriendProfile | School viewing others |
| `/userprofile` | UserProfile | User |
| `/friendsprofile/:id` | FriendsProfile | User viewing others |
| `/findtofollow` | FindToFollow | User / School |
| `/messages` | AllMessages | User / School |
| `/eschoolingstatus` | SidebarESchoolingStatus | User |
| `/usernoticeboard` | UserNoticeBoard | User (member) |
| `/noticeboard` | SidebarNoticeBoard | School |
| `/upcomingevents` | SchoolUpcomingEvents | School |
| `/verificationrequests` | SchoolVerificationRequests | School |
| `/verifiedmembers` | SchoolVerifiedMembers | School |
| `/addorremove` | SchoolAddOrRemove | School |
| `/classteacher` | ClassTeacherAllocate | School |
| `/schooltimetable` | SchoolTimeTable | School |
| `/syllabuscovered` | SchoolSyllabusCovered | School |
| `/projects&homeworks` | SidebarHomeWorks | User / School |
| `/leaveapplications` | SchoolLeaveApplications | School / Principal |
| `/schoolcomplaints` | SchoolComplaints | School |
| `/howtouse` | HowToUse | All |
| `/subscription` | Subscription (stub) | School |
