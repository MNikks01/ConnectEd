---
'@connected/types': minor
---

Export and erasure — the two subject rights `Security/04-compliance.md` has promised since Sprint 2
and the product has never had (S9-19, NFR-006, `PRD/14-export-and-erasure.md`).

Any account can ask for **one JSON file containing everything held about it**, built off the request
path by the worker, downloaded through a short-lived signed URL, and deleted seven days later. An
individual can also **schedule their own erasure**, with a 30-day grace period they can cancel at
any point.

**The interesting decision is ADR-0020: erasure keeps the `account` row and empties it.** Fifty-odd
tables carry an `account_id`, and the ones that matter most cascade — a pupil deleting their account
would have taken a term of the school's attendance register, its marks and its report cards with
them, which is a record the school is obliged to keep. So the row survives as a tombstone holding no
personal data, everything that is only about the person is deleted outright, and the school's
records go on pointing at an id that no longer resolves to anybody.

Two smaller design points came out of building it. A message thread is **not** the erasing party's
to delete — their messages go, the counterparty's stay, and the thread reads "A former member" on
one side. And an uploaded object is not always the uploader's to take: a photograph attached to a
homework item stays with the item.

Also here: a settings sub-navigation, which fixes something older — `/settings/profile` and
`/settings/security` had existed since Sprints 4 and 6 with nothing in the product linking to them.
