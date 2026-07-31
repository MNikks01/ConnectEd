# 06 — Mobile App (ConnectEdApp) Functionalities

The mobile app is the **primary client for individual users** (students, parents, teachers, principals, general users). It is an Expo/React Native Android app (package `com.mnikks01.ConnectEdApp`). **School accounts are blocked** on mobile.

## 6.1 Mobile-exclusive functionality (not on website)

### Onboarding carousel

- First-launch-only swipeable intro (`OnboardingScreen`), gated by a device flag. The website has no equivalent onboarding.

### Push notifications (device)

- The app registers for **Expo push notifications**, stores the token on the user document (`PUSH_NOTIFICATION`), and reacts to taps (tapping a homework notification deep-links to Projects & Homeworks). The website cannot receive device push.

### Banner advertising

- Google Mobile Ads (AdMob) banner (`BannerAd/`), configured with an Android app id in `app.json`. Web has no ads.

### Native navigation shell

- A **drawer + bottom-tab** navigation model:
  - **Drawer** (academic + discovery): Projects & Homeworks, Noticeboard, Timetable, Syllabus Covered, Leave Application, Complaints & Feedback, Social, E-Schooling Status, Find Schools, Find Friends. The academic entries appear only when the user has an e-schooling status; Leave/Complaints are hidden for students.
  - **Bottom tabs** (social): Home feed, Connections (friends), Messages, Account, Create Post.

## 6.2 Full mobile capability list

### Authentication

- Onboarding, Login, Register (User/Student/Parent/Teacher), "How to create account" helper.

### Social (bottom tabs)

- **Home feed** — posts from followed schools/users.
- **Create Post** — text + image posts.
- **Connections/Friends** — send/accept requests; badge for pending received.
- **Messages** — 1:1 chat; unread badge.
- **Account** — own profile & account management (shown only when the user has a status).

### Discovery (drawer)

- **Find Schools** — browse & follow schools.
- **Find Friends** — browse & connect/follow users.

### E-Schooling (drawer)

- **E-Schooling Status** — add/view student/parent/teacher/principal status; add children; submit verification requests.
- **Projects & Homeworks** — role-specific views; teachers publish, students/parents consume; unread badge.
- **Noticeboard** — school notices; unread badge.
- **Timetable** — per-class timetable image.
- **Syllabus Covered** — subject-wise progress.
- **Leave Application** — apply (parents/teachers) or approve (class teacher/principal); received badge; **hidden for students**.
- **Complaints & Feedback** — submit/review; **hidden for students**.

### Contextual role behaviour on mobile

- **Parent:** operates around a "currently selected child"; academic views scope to that child's school/class.
- **Teacher:** sees a publisher view for homework and, if a class teacher, a leave-approval inbox.
- **Principal:** sees teacher-leave approvals and school-wide academic data.
- **Student:** read-only academics; no Leave/Complaints.
- **General User:** only the social tabs + Find Schools/Friends; no academic drawer entries.

## 6.3 Mobile navigation stacks (from `Navigation/`)

| Stack                              | Contains                                          |
| ---------------------------------- | ------------------------------------------------- |
| `AuthStack`                        | Onboarding, Login, Register, HowToCreateAccount   |
| `AppStack` (Drawer)                | Home shell wrapping everything below              |
| `TabNavigator`                     | Home, Friends, Messages, Account, Create          |
| `HomeStack`                        | Home feed, post detail, likes, comments, profiles |
| `FriendsStack`                     | Connections, requests, friend profiles            |
| `MsgStack`                         | Messages list & conversation                      |
| `AccountStack`                     | Own profile, edit profile                         |
| `HWStack`                          | Projects & Homeworks (role views)                 |
| `TimetableStack`                   | Timetable views                                   |
| `SyllabusCoveredStack`             | Syllabus progress views                           |
| `LeaveStack`                       | Leave application views                           |
| `ComplaintStack`                   | Complaints & feedback views                       |
| `ESchoolingStack`                  | E-schooling status management                     |
| `FollowerStack` / `FollowingStack` | Followers & following lists                       |

## 6.4 App configuration signals

- **Theme:** light UI, brand blue `#2e81f4`, portrait orientation.
- **Notifications:** custom notification icon; Expo notifications plugin.
- **Ads:** AdMob android app id `ca-app-pub-7377721778111603~5977510283`.
- **Build:** Expo EAS project; Android `versionCode 20`, app version `1.0.19`.
