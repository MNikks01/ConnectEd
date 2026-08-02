# Sprint 4 — Social

`Status: Planned` · `Last updated: 2026-08-02` · Duration: 2 weeks

Goal: the layer that is open to everyone. Maps to roadmap **Phase 4**. This is a **proposal for planning** —
adjust the split before committing.

## Sprint goal

> Anyone with an account — verified or not, individual or school — has a profile, posts to it, follows others,
> and messages them. Nothing here waits on a school's approval, and nothing here reaches academic data.

## What makes this sprint different

Every module so far has been **gated by verification**. Social is the first that is not: `PRD/06-social.md`
opens with "available to **all** account types (including General Users and Schools). No verification
required."

That inverts the habit three sprints have built. The risk is not that a policy is too strict — it is that a
reviewer, seeing a module with almost no membership checks, reads it as unfinished rather than as correct. Two
consequences worth planning for:

- **The permission matrix rows for social are `✅` across every column.** The matrix suite should still assert
  them, precisely because "everyone can" is a claim that can regress silently.
- **Ownership replaces membership as the main check.** Edit and delete are author-only (`FR-SOC-004`), and
  `assertOwnsResource` already exists for exactly that.

## Prerequisites

| #     | Item                                                                               | Why it blocks                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4-0a | **A `/me/*` convention in `API/01-conventions.md`**                                | Three endpoints have now been added because the API could not answer "what is mine?". Social adds at least four more (feed, threads, connections, blocks). |
| S4-0b | **Rate limits on posting and messaging** (`PRD/06-social.md`, Moderation & safety) | The first endpoints in this product a stranger can call at volume. `RATE_LIMIT_ENABLED` and the limiter already exist; the rules do not.                   |

## Committed backlog (proposed)

| #    | Item                                                                  | Owner (agent) | Est. | DoD                                                                           |
| ---- | --------------------------------------------------------------------- | ------------- | ---- | ----------------------------------------------------------------------------- |
| S4-1 | Profiles: read and edit own (FR-SOC-001)                              | backend       | M    | Owner edits; privacy setting respected; a school profile is a profile too     |
| S4-2 | Posts: publish, edit, soft-delete (FR-SOC-002, 004)                   | backend       | M    | Author-only edit/delete; optional image claims its media key                  |
| S4-3 | Likes and comments (FR-SOC-003)                                       | backend       | M    | One like per account, toggled; comments chronological; author-only delete     |
| S4-4 | Follow and unfollow (FR-SOC-010)                                      | backend       | S    | Directional; counts correct; following yourself is refused                    |
| S4-5 | Connection requests (FR-SOC-011)                                      | backend       | M    | Request → accept/reject/cancel; mutual; no duplicate pending pairs            |
| S4-6 | Feed (FR-SOC-012)                                                     | backend       | M    | Reverse-chronological, cursor-paginated, from follows + connections           |
| S4-7 | Direct messages: threads and per-message read state (FR-SOC-020, 021) | backend       | L    | 1:1 threads; unread counts accurate and cleared on read                       |
| S4-8 | Report and block (`PRD/06-social.md`, Moderation & safety)            | backend       | M    | Blocking hides both ways; a report is recorded for review; ± permission tests |
| S4-9 | Social in the web app                                                 | frontend      | L    | Profile, timeline, feed, connections, and an inbox; all six states            |

## Stretch (only if committed done)

| #     | Item                                                             | Owner   |
| ----- | ---------------------------------------------------------------- | ------- |
| S4-10 | The four unbuilt dashboards, and the metrics they need           | devops  |
| S4-11 | Real-time message delivery over websockets (FR-SOC-022)          | backend |
| S4-12 | Find the idle transaction that blocks the API test suite's reset | backend |

## Dependencies / risks

- **Minor safety is not a stretch item.** This is a product used by children. `S4-8` (report and block) is in
  the committed backlog rather than the stretch list on purpose, and shipping posting without it would be the
  wrong order.
- **The feed is the first unbounded read across accounts.** Cursor pagination exists (S2-0b); the risk is the
  query, not the contract. A feed assembled with one query per followed account will be fine in test and
  useless at a hundred follows.
- **Blocking interacts with everything.** A blocked account must disappear from the feed, from search, from
  threads, and from comment lists. Deciding where that filter lives — once, in a shared place — is a design
  question worth settling before S4-2 rather than after S4-8.
- **`message.is_viewed` is a legacy array.** `Database/01-schema.md` already models it relationally; the risk is
  a per-message read state that turns into an N+1 on every thread open, the same shape the class feed hit.
- **Three matrix rows remain**, and this sprint should close two of them. Billing is Phase 5.

## Ceremonies

Planning · daily async standup · backlog refinement · review · retro.

## Definition of Done (item-level)

Code and tests, including **positive and negative permission tests for every scoped endpoint** · CI green ·
reviewed by a human and CodeRabbit · changeset · docs/ADRs updated · UI ships
Loading/Error/Empty/Success/Responsive/Accessible.

## Out of scope

Billing — Phase 5. Push notifications and the mobile app — mobile phase.

## Review notes

_Filled at sprint review._

## Retro

_Filled at retro._
