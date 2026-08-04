# API — Endpoint Catalogue

`Status: Accepted` · `Last updated: 2026-08-01`

Grouped by module. All under `/api/v1`. **Auth** column: 🔓 public · 🔑 authenticated · 🛡 authorized (role/
verification/ownership checked). This is the contract; the OpenAPI spec (generated) is authoritative for shapes.

## Auth & accounts

| Method | Path                    | Auth | Purpose                                                          |
| ------ | ----------------------- | :--: | ---------------------------------------------------------------- |
| POST   | `/auth/register`        |  🔓  | Register individual.                                             |
| POST   | `/auth/register/school` |  🔓  | Register school (web only).                                      |
| POST   | `/auth/login`           |  🔓  | Login → access + refresh.                                        |
| POST   | `/auth/refresh`         |  🔑  | Rotate tokens.                                                   |
| POST   | `/auth/logout`          |  🔑  | Revoke refresh family.                                           |
| POST   | `/auth/password/forgot` |  🔓  | Start reset.                                                     |
| POST   | `/auth/password/reset`  |  🔓  | Complete reset (token).                                          |
| POST   | `/auth/email/verify`    |  🔑  | Confirm email.                                                   |
| GET    | `/me`                   |  🔑  | Current account + roles + verified contexts.                     |
| GET    | `/me/profile`           |  🔑  | My own profile, unrestricted, with my visibility setting.        |
| PATCH  | `/me/profile`           |  🔑  | Update own profile (individuals; schools use the portal).        |
| GET    | `/accounts/:id/profile` |  🔑  | Someone's profile — the card always, the rest per their setting. |
| POST   | `/me/role`              |  🔑  | Declare/switch academic role.                                    |

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
| GET    | `/me/class-teacher`               |  🔑  | Classes I am class teacher of — the queues I own. |
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

## Well-known

| Method | Path                     | Auth | Purpose                                                                                   |
| ------ | ------------------------ | :--: | ----------------------------------------------------------------------------------------- |
| GET    | `/.well-known/jwks.json` |  —   | Public keys access tokens are signed with (`ADR-0014`). Absent when signing is symmetric. |

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

| Method       | Path                      | Auth | Purpose                                                                                 |
| ------------ | ------------------------- | :--: | --------------------------------------------------------------------------------------- |
| POST         | `/posts`                  |  🔑  | Publish a post (rate limited, per account).                                             |
| GET          | `/posts/:id`              |  🔑  | Read one; 404 when blocked, deleted, or missing.                                        |
| PATCH/DELETE | `/posts/:id`              |  🔑  | Author only; delete is soft.                                                            |
| GET          | `/accounts/:id/posts`     |  🔑  | An account's timeline, cursor-paginated.                                                |
| GET          | `/feed`                   |  🔑  | Own posts plus follows and connections, reverse-chronological, cursor-paginated.        |
| POST         | `/posts/:id/like`         |  🔑  | Toggle a like; 200 either way, and the same request twice leaves you where you started. |
| POST         | `/posts/:id/comments`     |  🔑  | Comment on a post.                                                                      |
| GET          | `/posts/:id/comments`     |  🔑  | Comments, oldest first, blocked authors hidden.                                         |
| DELETE       | `/comments/:id`           |  🔑  | The comment's author only; delete is soft.                                              |
| POST         | `/accounts/:id/follow`    |  🔑  | Follow; idempotent.                                                                     |
| DELETE       | `/accounts/:id/follow`    |  🔑  | Unfollow; works even after a block.                                                     |
| GET          | `/accounts/:id/follow`    |  🔑  | Follow state and counts.                                                                |
| POST         | `/connections`            |  🔑  | Request a connection; one row per pair.                                                 |
| GET          | `/me/connections`         |  🔑  | Mine, `?status=` filters.                                                               |
| POST         | `/accounts/:id/block`     |  🔑  | Block; idempotent. Hides content both ways, everywhere.                                 |
| DELETE       | `/accounts/:id/block`     |  🔑  | Unblock; restores what was there rather than clearing it.                               |
| GET          | `/me/blocks`              |  🔑  | Who I have blocked. Never who has blocked me.                                           |
| POST         | `/reports`                |  🔑  | Report a post, comment, message, or account.                                            |
| GET          | `/me/reports`             |  🔑  | What I have reported.                                                                   |
| POST         | `/connections/:id/accept` |  🔑  | The other party accepts.                                                                |
| DELETE       | `/connections/:id`        |  🔑  | Reject, cancel, or disconnect — the same row, removed.                                  |
| POST         | `/threads`                |  🔑  | Find or start a thread with an account; 200 either way.                                 |
| GET          | `/threads`                |  🔑  | Inbox: threads, last message, unread counts and total.                                  |
| GET          | `/threads/:id/messages`   |  🔑  | Messages, newest first, cursor-paginated. Reading marks them read.                      |
| POST         | `/threads/:id/messages`   |  🔑  | Send (rate limited, per account).                                                       |

## Notifications & billing

| Method | Path                        | Auth | Purpose                                          |
| ------ | --------------------------- | :--: | ------------------------------------------------ |
| GET    | `/notifications?after=`     |  🔑  | List (`unreadCount` in the body, beside `data`). |
| POST   | `/notifications/:id/read`   |  🔑  | Mark read.                                       |
| POST   | `/notifications/read-all`   |  🔑  | Mark every unread one read.                      |
| PATCH  | `/me/notification-prefs`    |  🔑  | Preferences.                                     |
| POST   | `/me/push-tokens`           |  🔑  | Register device (mobile).                        |
| GET    | `/plans`                    |  🔑  | Available plans.                                 |
| GET    | `/schools/:id/subscription` |  🛡   | The school's own plan, limits, and usage.        |
| POST   | `/schools/:id/subscription` |  🛡   | Start/change subscription.                       |
| POST   | `/webhooks/payments`        | 🔓*  | Provider webhook (signature-verified).           |

## Real-time

| Method | Path                  | Auth | Purpose                                                     |
| ------ | --------------------- | :--: | ----------------------------------------------------------- |
| POST   | `/me/realtime-ticket` |  🔑  | Mints a single-use, 30s ticket for one WebSocket upgrade.   |
| —      | `/ws?ticket=…`        |  🎫  | WebSocket. Outside `/api/v1`; not a versioned REST surface. |

🎫 authorized by ticket, not by a bearer token — a browser cannot set headers on a WebSocket upgrade
(ADR-0016). The socket carries **no content**: a frame says a thread moved, and the client re-reads
through the REST API, which authorizes each read. Nothing sent by the client is acted on.

## Ops

| Method | Path       | Auth | Purpose                                 |
| ------ | ---------- | :--: | --------------------------------------- |
| GET    | `/healthz` |  🔓  | Liveness.                               |
| GET    | `/readyz`  |  🔓  | Readiness (DB/Redis/storage).           |
| GET    | `/metrics` | 🔓†  | Prometheus scrape (network-restricted). |

\* webhook auth is by provider signature, not user token. † `/metrics` restricted to the monitoring network.
