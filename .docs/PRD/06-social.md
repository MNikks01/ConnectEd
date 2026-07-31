# PRD — Social Layer

`Status: Accepted` · `Last updated: 2026-07-28`

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
| FR-SOC-022 |    P2    | Real-time delivery (websocket) instead of polling. | Sub-second delivery when both online.                                  |

## Moderation & safety

- Report post/user/message; blocklist.
- Content stored with soft-delete for retention/audit.
- Rate-limits on posting/messaging to deter spam.
