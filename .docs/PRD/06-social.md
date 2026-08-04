# PRD — Social Layer

`Status: Accepted` · `Last updated: 2026-08-04`

Available to **all** account types (including General Users and Schools). No verification required.

## Profiles & Timeline

| ID         | Priority | Requirement                                                                         | Acceptance criteria                                            |
| ---------- | :------: | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| FR-SOC-001 |    P0    | Every account has a profile (display pic, bio, achievements; role-specific fields). | Editable by owner; visible per privacy setting.                |
| FR-SOC-002 |    P0    | Users & schools publish posts to their timeline (text + optional image).            | Post created; appears on author timeline and followers' feeds. |
| FR-SOC-003 |    P0    | Members like and comment on posts.                                                  | Like toggle (one per member); comments listed chronologically. |
| FR-SOC-004 |    P1    | Author can edit/delete their own post/comment.                                      | Soft-delete; restricted to author.                             |

## Follow & Connections

| ID         | Priority | Requirement                                                 | Acceptance criteria                                             |
| ---------- | :------: | ----------------------------------------------------------- | --------------------------------------------------------------- |
| FR-SOC-010 |    P0    | A user follows other users and schools (directional).       | Follow/unfollow; follower & following counts.                   |
| FR-SOC-011 |    P0    | Users send/accept friend connection requests (mutual).      | Request → accept creates a connection; reject/cancel supported. |
| FR-SOC-012 |    P1    | Feed aggregates posts from followed accounts + connections. | Reverse-chronological v1; ranked later.                         |

## Direct messaging

| ID         | Priority | Requirement                                        | Acceptance criteria                                                    |
| ---------- | :------: | -------------------------------------------------- | ---------------------------------------------------------------------- |
| FR-SOC-020 |    P0    | Users message other users; schools have an inbox.  | 1:1 threads; per-message read state (`IS_VIEWED` legacy → relational). |
| FR-SOC-021 |    P1    | Unread message badges.                             | Accurate unread counts; cleared on read.                               |
| FR-SOC-022 |    P2    | Real-time delivery (websocket) instead of polling. | Sub-second delivery when both online. **Built** — S5-11, ADR-0016.     |

## Moderation & safety

- Report post/user/message; blocklist.
- Content stored with soft-delete for retention/audit.
- Rate-limits on posting/messaging to deter spam.

> **Implemented as of S4-8; the queue gained a reader in S6-6.**
>
> Blocking is complete: it is applied on **every** social read — timeline, feed, comments, threads, and the
> unread badge — in **both directions**, and unblocking restores what was there rather than clearing follows and
> connections. Reporting records a row per reporter per subject, accepts reports about soft-deleted content
> (which is the case moderation most needs), and cannot be silenced by blocking the reporter.
>
> **The report queue is read** (S6-6). Reports go to ConnectEd staff holding `PLATFORM_ADMIN`
> (**ADR-0017**) — not the school and not the principal, because a report is often _about_ someone at the
> reporter's school and the form promises in as many words that nobody there is told. The rows accumulated
> unread from S4-8 until then, so the first reviewers inherit the history rather than starting from nothing.
>
> Three things the queue will not do. **It never names the reporter** — that promise is kept in the DTO, not
> in the UI that renders it. **It does not show the body of a private message**: a conversation between two
> people is not made public by one of them reporting it, so a reviewer gets the sender and the reporter's
> description, which is enough to act on an account. And **`ACTIONED` removes the content** — a verdict that
> changes nothing teaches a reviewer that the button is decorative — which is why an account report cannot be
> actioned here at all: suspending an account needs more than a queue button, and a reviewer must not be able
> to believe they have dealt with something they have not.
>
> Rate limits: 30 posts and 120 messages per account per hour, per `RATE_LIMIT_ENABLED`.
