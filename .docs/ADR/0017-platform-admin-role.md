# ADR-0017 — A platform-admin role, for moderation and nothing else

`Status: Accepted` · `Date: 2026-08-04` · Supersedes: — · Superseded by: —

## Context

Since S4-8 a child can report a post, a comment, a message, or an account. `PRD/06-social.md` has
carried the note that **nothing reads the resulting queue**, and every sprint review since has
repeated it: it is the one place the product makes a user-facing promise it does not keep. The
reporting form says, in as many words, _"Nobody at your school is told."_

Who should read those reports has been an open product question for three sprints, because none of
the seven roles in the permission matrix fits:

- **The school** moderates its own community, and for a report about a classmate that is the right
  instinct. But social spans schools — a student may report an account at another school, or one
  with no school at all — and the school has no standing over those.
- **The principal** is worse, not better: a report is often _about_ someone at the reporter's
  school, sometimes a member of staff. Routing it to the school's most senior member of staff is
  precisely the outcome the form promises will not happen.
- **Nobody** has been the status quo, and it is not neutral. Rows accumulate; a child who reports
  something is told it was received; nothing happens.

## Decision

**A `PLATFORM_ADMIN` capability held by ConnectEd staff, scoped to the moderation queue and
nothing else.**

- It is a **column on `account`** (`is_platform_admin`), not a value in `UserRole`. That enum is
  the _academic_ role, carried on a school membership; a platform admin is not a member of
  anything, and adding it there would make every membership query answer a question it was not
  asked.
- It is **never a token claim**. `assertPlatformAdmin` reads the row on every request.
- It is **not grantable through the API**. There is no endpoint, for anyone, at any privilege. It
  is set by `pnpm --filter @connected/api admin:grant <email>`, which runs against the database and
  writes an `AuditLog` entry.
- It confers **exactly one thing**: the moderation queue. It is not an override, not a support
  impersonation, and it does not widen any existing policy. A platform admin reading a school's
  homework gets the same 404 anybody else would.

## Why not the alternatives

**A `SUPPORT`/`ADMIN` value in `UserRole`.** Cheapest, and wrong in a way that would be expensive
later: every `requireRole` call site and every membership query would have to learn that one role
means something categorically different from the others. The matrix has seven columns because the
product has seven kinds of user; staff are not an eighth kind of user.

**A separate admin application with its own auth.** Genuinely safer — a separate deploy, separate
credentials, no shared session surface — and disproportionate for a queue with no readers at all
today. Revisit when the console does more than moderation.

**An endpoint that grants the role, guarded by the role.** The bootstrapping problem has an ugly
answer (a seeded first admin) and the real objection is different: the highest-privilege capability
in the product would be reachable by any bug that reaches that endpoint. A capability that can only
be granted by someone with a database connection has a much smaller attack surface than one that
can be granted by an HTTP request.

**Letting schools moderate their own.** Kept as a future possibility for reports where both parties
are members of one school, and deliberately not built now: it needs a rule for the cross-school
case anyway, and shipping the general answer first means the special case is an optimisation rather
than a rewrite.

## Consequences

- **The permission matrix gains a row where every one of the seven columns is `➖`.** That is the
  point, and the matrix suite asserts it: no product role — not the school, not the principal —
  can read the queue.
- **Revocation is immediate**, because the check is a read rather than a claim.
- **A suspended staff account is not staff.** The policy checks `status` as well as the flag.
- **Nothing about the reporter is disclosed** to the subject of a report; that constraint lives in
  the queue's DTOs, not only in its UI.
- **Every decision is audited.** Moderation is the first capability in this product that acts on
  content the actor does not own, and the audit trail is what makes that power reviewable.
- Granting requires a database connection and a deploy-time credential. That is a deliberate
  friction, and it means staff onboarding is an ops task rather than a UI one.
