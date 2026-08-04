# Sprint 4 — Social

`Status: Done` · `Last updated: 2026-08-02` · Duration: 2 weeks

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

**The committed backlog shipped in full.** The three stretch items did not, and are carried.

| Item                                     | PR  |
| ---------------------------------------- | --- |
| S4-0a `/me/*` convention · S4-1 profiles | #38 |
| S4-2 posts, and the blocking filter      | #39 |
| S4-3 likes and comments                  | #40 |
| S4-4, S4-5 follows and connections       | #41 |
| S4-6 the feed                            | #43 |
| S4-7 direct messages                     | #44 |
| S4-8 report and block                    | #45 |
| S4-9 social in the web app               | #46 |

Tests grew from 603 to **738 API + 57 UI + 61 E2E**. The permission-matrix inventory is down to **one row**,
`Manage subscription/billing`, which is Phase 5.

**The sprint's premise held.** Social is the first module with no verification gate, and the plan predicted the
risk would be a reviewer reading the absence of membership checks as unfinished. Every module docstring and the
profile test file say so explicitly, and the two social matrix rows assert `✅` for all seven roles precisely
because "everyone can" regresses as quietly as anything else.

**Blocking was built before the feature that needed it, and that was the right call.** S4-2 added the filter
with the posts it applied to, four PRs before the endpoints that create a block. By the time S4-8 landed, the
filter had already been threaded through the timeline, the feed, comments, threads and the unread badge — and
two of those needed their own fix:

- The comment list needed its own filter, because a comment under a post you can see is a different query.
- **`unreadTotal` counted messages from blocked accounts**, so the badge pointed at a conversation neither party
  could open. Found by a test written for exactly that.

Retrofitting that filter across five queries after the fact would have been the sprint's worst afternoon.

**Two tests were wrong before they were right.**

- The feed's cost test passed **vacuously**: the shared client has no query logging, so the listener never
  fired and `0 === 0` passed. It now builds its own client and asserts the count is non-zero before comparing.
- A sabotage check on messaging was run without asserting the edit applied; the string had not matched, so the
  first "it still passes" result meant nothing. Both now guard themselves.

**A shipped bug, found by writing a test for something else.** The API reads `?cursor=`; the web app sent
`?after=` on the class feed, notices and notifications. **Every "older" link had silently returned page one
since the day it shipped.** Three one-word fixes.

**The `/me/*` convention paid for itself immediately** — social added four more such endpoints (`/me/blocks`,
`/me/reports`, `/me/connections`, `/me/profile`), and none of them needed the question asking again.

**A promise the product does not yet keep.** Reporting records rows and **nothing reads them**. Who reviews a
report is unresolved: a school moderates its own community, but social spans schools and there is no
platform-admin role. It is written into `PRD/06-social.md` as the one place a user-facing promise is unkept, and
it needs a product decision before social reaches real children.

**Carried into Sprint 5:** the four unbuilt dashboards and their metrics, websocket message delivery, the
local-only test flake, and the report-review question above.

**Still open for the team, fifth sprint running:** branch protection.

## Retro

_To be completed by the team at the retro — went well / didn't / actions with owners and due dates._
