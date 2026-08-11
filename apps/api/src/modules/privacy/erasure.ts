/**
 * What erasure actually does, table by table (ADR-0020, FR-DSR-024).
 *
 * This file is the executable half of the disposition table in
 * [`.docs/PRD/14-export-and-erasure.md`](../../../../../.docs/PRD/14-export-and-erasure.md). The two
 * are meant to be read side by side, and a table that appears in one and not the other is a bug in
 * whichever was edited last.
 *
 * **Severing is not a write.** The surprising part of this file is how little it does to the rows
 * it keeps. A mark, a register entry, a report card and a homework item all carry the account id
 * and go on carrying it — severance happens because the account they point at stops being a
 * person, not because those rows change. Trying to "clear" them is what the `SetNull` alternative
 * in ADR-0020 would have required, and it is the thing that would have made every academic read
 * handle a subject that is nobody.
 *
 * So the code below has exactly three kinds of statement:
 *
 * 1. `deleteMany` for rows that are only about the person,
 * 2. two targeted updates — memberships to `REVOKED`, so no fan-out reaches a tombstone — and
 * 3. the scrub of `account` itself, which is the moment the person stops existing.
 */
import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../generated/prisma/client.js';

/** Rows removed per table, for the audit entry (FR-DSR-027). */
export type ErasureCounts = Record<string, number>;

export interface ErasureOutcome {
  counts: ErasureCounts;
  /**
   * Objects to delete from the bucket after the transaction commits.
   *
   * Only the ones whose sole referent was content this erasure deleted — a display picture and
   * the images on the person's own posts. **Attachments on academic items are deliberately not
   * here:** a homework photo belongs to the class the homework was set for, and the item survives
   * as the school's record. Deleting the object would leave a severed row pointing at a key that
   * 404s, which is worse than a photo taken by somebody who has left.
   */
  mediaKeys: string[];
}

/**
 * A placeholder that occupies the unique index without being deliverable.
 *
 * `.invalid` is reserved by RFC 2606 precisely so it can never resolve, which matters more than it
 * looks: the address ends up in `account.email`, and anything that later iterates accounts to send
 * mail must be incapable of reaching a tombstone by accident.
 */
function erasedEmail(): string {
  return `erased-${randomUUID()}@erased.invalid`;
}

/**
 * Runs the whole disposition inside the caller's transaction (FR-DSR-025).
 *
 * Order is by foreign key, not by importance: children before parents, and the account scrub last,
 * so that a failure anywhere leaves nothing half-erased.
 */
export async function eraseAccount(
  tx: Prisma.TransactionClient,
  accountId: string,
  hashEmail: (email: string) => string,
): Promise<ErasureOutcome> {
  const counts: ErasureCounts = {};

  const record = async (table: string, run: Promise<{ count: number }>): Promise<void> => {
    counts[table] = (await run).count;
  };

  const account = await tx.account.findUniqueOrThrow({
    where: { id: accountId },
    select: { email: true },
  });

  // ---------------------------------------------------------------------
  // Collected before anything is deleted: the keys are read off rows this
  // function is about to remove.
  // ---------------------------------------------------------------------
  const profile = await tx.userProfile.findUnique({
    where: { accountId },
    select: { displayPicKey: true },
  });

  const ownPosts = await tx.post.findMany({
    where: { authorAccountId: accountId },
    select: { imageKey: true },
  });

  const mediaKeys = [profile?.displayPicKey, ...ownPosts.map((post) => post.imageKey)].filter(
    (key): key is string => Boolean(key),
  );

  // ---------------------------------------------------------------------
  // 1. Authentication material. Nobody else has an interest in any of it.
  // ---------------------------------------------------------------------
  await record('credential', tx.credential.deleteMany({ where: { accountId } }));
  await record('refreshToken', tx.refreshToken.deleteMany({ where: { accountId } }));
  await record('passwordResetToken', tx.passwordResetToken.deleteMany({ where: { accountId } }));
  await record('twoFactorChallenge', tx.twoFactorChallenge.deleteMany({ where: { accountId } }));
  // Recovery codes hang off the secret and cascade with it, but are counted separately: "we
  // deleted the 2FA secret" and "we deleted the eight codes that could bypass it" are different
  // claims, and the audit entry should be able to make both.
  await record('recoveryCode', tx.recoveryCode.deleteMany({ where: { accountId } }));
  await record('twoFactorSecret', tx.twoFactorSecret.deleteMany({ where: { accountId } }));

  // Keyed on a hash of the address rather than on the account. It matters because the address is
  // released below: a throttle left behind would apply to whoever registers it next, including the
  // same person starting again.
  await record(
    'loginThrottle',
    tx.loginThrottle.deleteMany({ where: { emailHash: hashEmail(account.email) } }),
  );

  // ---------------------------------------------------------------------
  // 2. The person's own content and their own plumbing.
  // ---------------------------------------------------------------------
  await record('pushToken', tx.pushToken.deleteMany({ where: { accountId } }));
  await record(
    'notification',
    tx.notification.deleteMany({ where: { recipientAccountId: accountId } }),
  );
  await record('notificationPref', tx.notificationPref.deleteMany({ where: { accountId } }));
  await record('readReceipt', tx.readReceipt.deleteMany({ where: { accountId } }));

  await record('postLike', tx.postLike.deleteMany({ where: { accountId } }));
  await record('postComment', tx.postComment.deleteMany({ where: { accountId } }));
  // Comments and likes *on* their posts cascade with the post — those are other people's, and
  // this is the one place the product removes somebody else's words. It is unavoidable: a comment
  // is a reply to a body that is going, and orphaning it would leave a reply to nothing.
  await record('post', tx.post.deleteMany({ where: { authorAccountId: accountId } }));

  await record(
    'follow',
    tx.follow.deleteMany({
      where: { OR: [{ followerAccountId: accountId }, { followeeAccountId: accountId }] },
    }),
  );
  await record(
    'connection',
    tx.connection.deleteMany({
      where: { OR: [{ aAccountId: accountId }, { bAccountId: accountId }] },
    }),
  );
  await record(
    'block',
    tx.block.deleteMany({
      where: { OR: [{ blockerAccountId: accountId }, { blockedAccountId: accountId }] },
    }),
  );

  // **Their messages, not the thread.** Deleting the thread would take the counterparty's words
  // with it, and those are the counterparty's — written by them, about them, and theirs to keep.
  // The thread survives showing "A former member" on one side (FR-DSR-030), unless nothing is left
  // in it at all, in which case there is no conversation to preserve.
  await record('message', tx.message.deleteMany({ where: { senderAccountId: accountId } }));

  const emptyThreads = await tx.messageThread.findMany({
    where: {
      OR: [{ participantA: accountId }, { participantB: accountId }],
      messages: { none: {} },
    },
    select: { id: true },
  });

  await record(
    'messageThread',
    tx.messageThread.deleteMany({ where: { id: { in: emptyThreads.map((t) => t.id) } } }),
  );

  await record('feedback', tx.feedback.deleteMany({ where: { authorAccountId: accountId } }));
  await record('dataExport', tx.dataExport.deleteMany({ where: { accountId } }));

  // Their own record of their own children. The *pupil's* account, membership, marks and register
  // entries are a different subject entirely and are untouched by this — a parent erasing
  // themselves does not erase their child.
  await record('child', tx.child.deleteMany({ where: { parentAccountId: accountId } }));

  // Deleting the profile releases the handle, which is what makes the account unfindable. Every
  // directory and search read joins this row, so its absence is the exclusion in FR-DSR-031 rather
  // than a filter each of those reads has to remember.
  await record('userProfile', tx.userProfile.deleteMany({ where: { accountId } }));

  // FR-DSR-032. Allocations and the class-teacher row cascade from the profile, which is the point:
  // a class must not be left with a class teacher nobody can contact or replace. The subjects,
  // classes and assessments themselves are the school's and stay.
  await record('teacherProfile', tx.teacherProfile.deleteMany({ where: { accountId } }));

  // Media rows for the objects being deleted above. Everything else the person uploaded stays,
  // pointing at the tombstone — `uploadedBy` is documented as an audit trail rather than an
  // authorization input, and the rows are what the orphan sweep reads.
  await record('mediaObject', tx.mediaObject.deleteMany({ where: { key: { in: mediaKeys } } }));

  // ---------------------------------------------------------------------
  // 3. Severance. Two updates, and everything else is left exactly as it is.
  // ---------------------------------------------------------------------

  // The school keeps its record that somebody held a place; `REVOKED` is the state it already uses
  // for a member who has left, so every fan-out, roll and roster excludes them without a single
  // new condition anywhere. This is the whole of FR-DSR-031 for notifications.
  counts['membershipRevoked'] = (
    await tx.membership.updateMany({
      where: { accountId, status: { not: 'REVOKED' } },
      data: { status: 'REVOKED' },
    })
  ).count;

  // ---------------------------------------------------------------------
  // 4. The scrub. After this the row is a stable, meaningless id.
  // ---------------------------------------------------------------------
  await tx.account.update({
    where: { id: accountId },
    data: {
      // Releasing the address is deliberate: the person may register again and get a genuinely new
      // account. An erasure that also banned the address would be a punishment rather than a right.
      email: erasedEmail(),
      emailVerifiedAt: null,
      status: 'ERASED',
      // Read from the database on every privileged request rather than from a token, so clearing
      // it here takes effect immediately (ADR-0017).
      isPlatformAdmin: false,
      deletedAt: new Date(),
    },
  });

  counts['account'] = 1;

  return { counts, mediaKeys };
}
