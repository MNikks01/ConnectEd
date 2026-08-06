# ADR-0018 — A school may have more than one principal

`Status: Accepted` · `Date: 2026-08-06` · Supersedes: — · Superseded by: —

## Context

`PRD/02-institution.md` has carried FR-INST-007 as a question rather than a requirement since the
PRD was written: _"A school can have multiple principals? (default: one)"_, with the acceptance
criteria reading **"Assumption: single principal per school in v1; multi supported later."**

An assumption in an acceptance-criteria column is a decision nobody made. It has survived six
sprints, appeared in every completeness pass as neither built nor blocked, and — this is the part
that matters — **it was never true of the code.**

Nothing in `apps/api` has ever enforced one principal per school. Every principal check is
`assertVerifiedMembership(db, actor, schoolId, 'PRINCIPAL')`, which asks whether _this_ caller holds
that membership and never how many other people do. The unique constraint on `membership` is
`(account_id, school_id, role, scope_key)`, which stops one account holding the same membership
twice; it says nothing about two accounts holding the same role. A school could always have approved
a second principal, and nothing would have stopped it.

So the real question was not "should we build this" but "which of the two do we mean" — and leaving
it unanswered meant the product had a capability that was neither designed, tested, nor documented.

## Decision

**A school may verify any number of principals. They are equal: identical scope, identical
authority, no ordering and no primary.**

Not chosen, and why:

- **One principal, enforced.** It matches the written assumption and it is defensible for a small
  school. But it is wrong about how schools work — a large one has a head and several deputies who
  genuinely share the work — and enforcing it now would mean _removing_ a capability that already
  functions, which is a strange thing to ship.
- **A principal plus a distinct deputy role.** More faithful to a real hierarchy, and rejected as
  a worse trade: it adds an eighth role to the permission matrix and to every negative permission
  test, in exchange for a distinction the product does not currently act on anywhere. If a
  capability ever needs to separate them, that is the moment to add it.

## Consequences

**A principal is still not a school account, and two of them are not one either.** The capabilities
denied to a principal — the verification queue, verifying or removing members, the school profile,
allocating a class teacher, analytics, billing, the moderation queue — stay denied however many
principals there are. This is the invariant most at risk from the decision, because "senior member
of staff" is exactly the intuition that would loosen it.

**Two principals can reach the same queue, so they can race.** A teacher's leave application appears
to both. The second decision on an already-decided application is refused with 409 rather than
silently overwriting the first — behaviour that existed before this decision and now has a reason to
exist.

**Nothing in the schema, the API, or the web app changes.** The work this ADR records is a test
file, `multiple-principals.test.ts`, which walks the flow a school actually uses — an account, a
request, an approval — and then asserts all three halves of the promise: that a second principal can
be verified, that they can do everything the first can, and that they can do nothing more.

**FR-INST-007 is resolved, not deferred.** It leaves the completeness record as built.
