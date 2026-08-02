# API — Endpoint Catalogue

`Status: Accepted` · `Last updated: 2026-08-01`

Grouped by module. All under `/api/v1`. **Auth** column: 🔓 public · 🔑 authenticated · 🛡 authorized (role/
verification/ownership checked). This is the contract; the OpenAPI spec (generated) is authoritative for shapes.

## Auth & accounts

| Method | Path                    | Auth | Purpose                                      |
| ------ | ----------------------- | :--: | -------------------------------------------- |
| POST   | `/auth/register`        |  🔓  | Register individual.                         |
| POST   | `/auth/register/school` |  🔓  | Register school (web only).                  |
| POST   | `/auth/login`           |  🔓  | Login → access + refresh.                    |
| POST   | `/auth/refresh`         |  🔑  | Rotate tokens.                               |
| POST   | `/auth/logout`          |  🔑  | Revoke refresh family.                       |
| POST   | `/auth/password/forgot` |  🔓  | Start reset.                                 |
| POST   | `/auth/password/reset`  |  🔓  | Complete reset (token).                      |
| POST   | `/auth/email/verify`    |  🔑  | Confirm email.                               |
| GET    | `/me`                   |  🔑  | Current account + roles + verified contexts. |
| PATCH  | `/me/profile`           |  🔑  | Update own profile.                          |
| POST   | `/me/role`              |  🔑  | Declare/switch academic role.                |

## Institution & classes

| Method | Path                              | Auth | Purpose                                           |
| ------ | --------------------------------- | :--: | ------------------------------------------------- |
| GET    | `/schools/:id`                    |  🔑  | School public/member profile.                     |
| PATCH  | `/schools/:id`                    |  🛡   | Update own school (school acct).                  |
| POST   | `/schools/:id/classes`            |  🛡   | Create class.                                     |
| GET    | `/schools/:id/classes`            |  🛡   | List classes.                                     |
| POST   | `/classes/:id/subjects`           |  🛡   | Add subject.                                      |
| GET    | `/classes/:id/subjects`           |  🔑  | Subjects of a class (needed before verification). |
| PATCH  | `/classes/:id`                    |  🛡   | Rename, activate, or deactivate a class.          |
| GET    | `/classes/:id/class-teacher`      |  🛡   | Who the class teacher is; 404 when unallocated.   |
| POST   | `/classes/:id/class-teacher`      |  🛡   | Allocate class teacher.                           |
| GET    | `/schools/:id/members`            |  🛡   | Roster.                                           |
| DELETE | `/schools/:id/members/:accountId` |  🛡   | Remove/revoke member.                             |

## Verification

| Method | Path                                        | Auth | Purpose                                                   |
| ------ | ------------------------------------------- | :--: | --------------------------------------------------------- |
| POST   | `/verifications`                            |  🛡   | Submit request (student/parent/teacher/principal).        |
| GET    | `/schools/:id/verifications?status=PENDING` |  🛡   | School reviews queue.                                     |
| POST   | `/verifications/:id/decision`               |  🛡   | Approve/reject.                                           |
| GET    | `/me/verifications`                         |  🔑  | My requests + statuses.                                   |
| GET    | `/me/memberships`                           |  🔑  | My verified memberships — how a member finds their class. |
| GET    | `/me/subjects`                              |  🔑  | Subjects I am allocated to teach.                         |
| DELETE | `/schools/:id/members/:accountId`           |  🛡   | School revokes a membership.                              |
| GET    | `/schools/:id/members`                      |  🛡   | The school's roster.                                      |

## Academics

| Method       | Path                              | Auth | Purpose                                             |
| ------------ | --------------------------------- | :--: | --------------------------------------------------- |
| POST         | `/classes/:id/academics`          |  🛡   | Teacher publishes item (type in body).              |
| GET          | `/classes/:id/academics`          |  🛡   | Verified member feed.                               |
| GET          | `/academics/:id`                  |  🛡   | Read item (marks read).                             |
| PATCH/DELETE | `/academics/:id`                  |  🛡   | Author edits/deletes.                               |
| POST         | `/schools/:id/notices`            |  🛡   | School or principal publishes a notice.             |
| GET          | `/schools/:id/notices`            |  🛡   | List notices (any verified member).                 |
| GET          | `/notices/:id`                    |  🛡   | Read notice (marks read).                           |
| PATCH/DELETE | `/notices/:id`                    |  🛡   | Author or school edits/deletes.                     |
| POST         | `/schools/:id/events`             |  🛡   | School creates an event.                            |
| GET          | `/schools/:id/events`             |  🛡   | Upcoming events; `?includePast=true` for all.       |
| PATCH/DELETE | `/events/:id`                     |  🛡   | School moves/cancels.                               |
| POST         | `/classes/:id/timetable`          |  🛡   | School uploads a timetable (creates a new version). |
| GET          | `/classes/:id/timetable`          |  🛡   | Current timetable; 404 until one exists.            |
| GET          | `/classes/:id/timetable/versions` |  🛡   | Earlier versions, newest first.                     |
| POST         | `/subjects/:id/syllabus`          |  🛡   | Allocated teacher records a topic.                  |
| GET          | `/subjects/:id/syllabus`          |  🛡   | Coverage for one subject.                           |
| GET          | `/classes/:id/syllabus`           |  🛡   | Coverage for every subject of a class.              |
| DELETE       | `/syllabus/:id`                   |  🛡   | Remove a topic recorded in error.                   |

## Media

| Method | Path             | Auth | Purpose                                                                                                                                                             |
| ------ | ---------------- | :--: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/media/:prefix` |  🔑  | Upload an image (`academic-items`, `timetables`, `avatars`, `posts`). Returns an opaque key; the owning module decides who may later be issued a signed URL for it. |

## Workflows

| Method | Path                                         | Auth | Purpose                                                         |
| ------ | -------------------------------------------- | :--: | --------------------------------------------------------------- |
| POST   | `/children/:childId/leave`                   |  🛡   | Parent applies for child.                                       |
| POST   | `/me/leave`                                  |  🛡   | Teacher applies for their own leave.                            |
| GET    | `/me/leave`                                  |  🔑  | My applications and their status.                               |
| GET    | `/classes/:id/leave?status=RECEIVED`         |  🛡   | Class-teacher queue.                                            |
| GET    | `/schools/:id/leave/teacher?status=RECEIVED` |  🛡   | Principal queue.                                                |
| POST   | `/leave/:id/decision`                        |  🛡   | Accept/reject.                                                  |
| POST   | `/schools/:id/feedback`                      |  🛡   | Parent, teacher, or principal raises a complaint or suggestion. |
| GET    | `/schools/:id/feedback`                      |  🛡   | The queue — school staff only; `?status=` filters.              |
| GET    | `/me/feedback`                               |  🔑  | What I raised, and where it got to.                             |
| POST   | `/feedback/:id/review`                       |  🛡   | School or principal moves it forward.                           |

## Social

| Method | Path                                 | Auth | Purpose                   |
| ------ | ------------------------------------ | :--: | ------------------------- |
| POST   | `/posts`                             |  🔑  | Create post.              |
| GET    | `/feed`                              |  🔑  | Aggregated feed (cursor). |
| POST   | `/posts/:id/like` / `DELETE`         |  🔑  | Like/unlike.              |
| POST   | `/posts/:id/comments`                |  🔑  | Comment.                  |
| POST   | `/accounts/:id/follow` / `DELETE`    |  🔑  | Follow/unfollow.          |
| POST   | `/connections`                       |  🔑  | Request connection.       |
| POST   | `/connections/:id/accept`            |  🔑  | Accept.                   |
| GET    | `/threads` · `/threads/:id/messages` |  🔑  | Messaging.                |
| POST   | `/threads/:id/messages`              |  🔑  | Send message.             |

## Notifications & billing

| Method | Path                        | Auth | Purpose                                          |
| ------ | --------------------------- | :--: | ------------------------------------------------ |
| GET    | `/notifications?after=`     |  🔑  | List (`unreadCount` in the body, beside `data`). |
| POST   | `/notifications/:id/read`   |  🔑  | Mark read.                                       |
| POST   | `/notifications/read-all`   |  🔑  | Mark every unread one read.                      |
| PATCH  | `/me/notification-prefs`    |  🔑  | Preferences.                                     |
| POST   | `/me/push-tokens`           |  🔑  | Register device (mobile).                        |
| GET    | `/plans`                    |  🔑  | Available plans.                                 |
| POST   | `/schools/:id/subscription` |  🛡   | Start/change subscription.                       |
| POST   | `/webhooks/payments`        | 🔓*  | Provider webhook (signature-verified).           |

## Ops

| Method | Path       | Auth | Purpose                                 |
| ------ | ---------- | :--: | --------------------------------------- |
| GET    | `/healthz` |  🔓  | Liveness.                               |
| GET    | `/readyz`  |  🔓  | Readiness (DB/Redis/storage).           |
| GET    | `/metrics` | 🔓†  | Prometheus scrape (network-restricted). |

\* webhook auth is by provider signature, not user token. † `/metrics` restricted to the monitoring network.
