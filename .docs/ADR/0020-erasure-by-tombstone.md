# ADR-0020 — Erasure keeps the account row and empties it

`Status: Accepted` · `Date: 2026-08-11` · Supersedes: — · Superseded by: —

## Context

[`Security/04-compliance.md`](../Security/04-compliance.md) has promised erasure since Sprint 2 and
required it be "implemented as a real, tested workflow (not manual DB edits)". Nothing was built,
and `PRD/10-completeness.md` records NFR-006 as ⛔.

The obvious implementation is `DELETE FROM account WHERE id = $1`. It is also wrong here, and the
reason is in the schema rather than in the requirement.

`account` is the hub of the data model. Fifty-odd tables carry an `account_id`, and the relations
that matter most are declared `onDelete: Cascade` — which is correct for everything the row is
_about_, and catastrophic for everything the row is merely _named in_:

```prisma
model AttendanceEntry { student Account @relation(..., onDelete: Cascade) }
model Mark            { student Account @relation(..., onDelete: Cascade) }
model AcademicItem    { author  Account @relation(..., onDelete: Cascade) }
model ReportCard      { student Account @relation(..., onDelete: Cascade) }
```

A pupil pressing "delete my account" would take a term of the school's register with them. A teacher
leaving would delete every homework item their classes were set, and every mark they wrote for
thirty other children. In most jurisdictions a school's attendance register is a record it is
_obliged_ to keep, so the cascade does not merely lose data — it makes the product an instrument for
breaking somebody else's legal duty.

The two obligations are both real and they point in opposite directions:

- the person has a right to have their personal data erased, and
- the school has a duty to keep records that happen to reference that person.

They are only in conflict if "the person" and "the id the record points at" are the same thing.

## Decision

**Erasure strips the account to a tombstone and deletes everything that is only about the person.
The `account` row itself survives, permanently, holding no personal data.**

Concretely, in one transaction:

1. Delete every row whose sole subject is the person — credentials and tokens, profile, posts,
   comments, likes, follows, connections, blocks, messages, notifications, preferences, push tokens,
   media, feedback, their own `Child` records, and any `data_export` rows.
2. Sever the rest: the row stays, its `account_id` still points here, and the identity it used to
   resolve to is gone.
3. Scrub the account: `status = ERASED`, `email` replaced with an unroutable, unique placeholder,
   `email_verified_at`, `is_platform_admin` and every profile relation cleared.
4. Write an `audit_log` row with per-table counts.

The full per-table disposition is [`PRD/14-export-and-erasure.md`](../PRD/14-export-and-erasure.md),
which is the contract the tests are written against; this ADR records why the shape is what it is.

**The email is released.** The placeholder occupies the unique index instead, so the person can
register again with the same address and receive a genuinely new account. An erasure that also
banned the address would be a punishment rather than a right.

**A severed row renders "A former member".** Read paths already join the profile to get a name; the
join now returns nothing, and every one of them must produce a neutral placeholder rather than a
blank, an id, or a crash. This is FR-DSR-030 and it is a requirement precisely because it is the
part that is easy to forget until a page 500s in production.

## Alternatives considered

**Hard delete with `onDelete: SetNull` everywhere.** Nullable author and student columns throughout
the academic schema. This is the honest version of "delete the row", and it was rejected for two
reasons. It makes every academic read handle a null subject — an attendance entry about nobody is
not a meaningful row, and the code that consumes one would have to invent a meaning. And it is a
migration that loosens fifty constraints in order to serve a path that runs rarely: the schema would
get permanently weaker so that one operation could be simpler.

**A single shared "deleted user" account.** One row every erased account's records repoint at. It
keeps the FKs non-null and the reads simple, and it destroys the distinction between two different
former pupils — a register would show the same person present and absent on the same morning. The
tombstone is the same idea with the identity kept distinct, which costs one row per erasure and
nothing else.

**Soft delete only — set `deleted_at` and filter on read.** Cheapest, and it is not erasure. The
personal data is still there, one forgotten `WHERE` clause from being visible, and the promise in
the compliance document is not "hidden".

**Anonymise in place without deleting anything.** Scrub the profile, keep the posts and messages
with the author blanked. Rejected because a message body is personal data regardless of whose name
is on it; anonymising the author of "I'll pick Aarav up at 4 from the north gate" anonymises nothing.

## Consequences

**A tombstone is a row that exists forever.** The table grows by one row per erasure and never
shrinks. At this product's scale that is nothing, and it is worth stating plainly rather than
discovering: erasure is not a way to shrink the database.

**"Erased" becomes a state every read path must handle.** `AccountStatus` gains `ERASED`, login
refuses it, and the fan-out, directory and search paths exclude it. FR-DSR-031 makes that a tested
requirement rather than an assumption, because the failure mode is silent — a notification sent to
nobody looks exactly like a quiet afternoon, which is the same shape as the outbox relay's failure
mode in ADR-0019.

**The audit trail names an id that no longer resolves to a person.** That is the intent: the record
of _what happened_ survives, and the person it happened to is no longer identifiable from it. It is
pseudonymisation rather than anonymisation, and if a regulator later disagrees the change is scoped
to `audit_log` alone.

**Retention (B-4) can reuse all of it.** A scheduled purge of a leaving pupil is the same execution
with a different trigger. That is why this is built as an executable disposition over tables rather
than as a request-handling endpoint with deletion inlined.

**Backups are out of reach.** An erasure that ran today does not reach a dump taken yesterday. This
is inherent to every implementation and belongs in the privacy notice; the restore drill
(`scripts/restore-drill.mjs`) would restore an erased account's data along with everything else.
Nothing in this ADR fixes that, and pretending otherwise would be worse than recording it.
