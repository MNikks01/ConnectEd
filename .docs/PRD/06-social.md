# PRD — Social Layer

`Status: Accepted` · `Last updated: 2026-08-02`

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

> **Implemented as of S4-8, with one gap that needs a product decision.**
>
> Blocking is complete: it is applied on **every** social read — timeline, feed, comments, threads, and the
> unread badge — in **both directions**, and unblocking restores what was there rather than clearing follows and
> connections. Reporting records a row per reporter per subject, accepts reports about soft-deleted content
> (which is the case moderation most needs), and cannot be silenced by blocking the reporter.
>
> **Nothing reads the report queue.** Who reviews a report is unresolved: a school moderates its own community,
> but social spans schools and this product has no platform-admin role. The rows accumulate deliberately, so
> whoever gets that job inherits the history — but until someone does, a report reaches only the application
> log. **This is the one place in the product where a user-facing promise ("report this") is not yet kept**, and
> it should be resolved before social ships to real children rather than after.
>
> Rate limits: 30 posts and 120 messages per account per hour, per `RATE_LIMIT_ENABLED`.
