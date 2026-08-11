/**
 * Building the export bundle (FR-DSR-003).
 *
 * **Every query here uses an explicit `select`.** Not for efficiency — for the two negative
 * requirements, which are the only ones in this feature that can fail silently. A `select` is the
 * mechanism by which FR-DSR-010 (never authentication material) and FR-DSR-011 (never another
 * person's data) hold: a bundle built from `include: true` would grow a password hash the day
 * somebody adds a relation, and nothing would notice. Listing the columns means a new column is
 * absent from the export until a person decides it belongs there, which is the right default for a
 * file that concentrates one person's whole record in one place.
 *
 * The individual and school bundles are separate functions rather than one with branches. They
 * share almost nothing — a school's record is its institution, not its pupils (FR-DSR-012) — and
 * the one thing worth preventing here is a condition that accidentally falls through to the wrong
 * side.
 */
import type { Db } from '../../shared/db/index.js';
import type { DataExportBundle } from '@connected/types';

/** Bumped when the shape changes in a way somebody reading an old bundle could notice. */
const SCHEMA_VERSION = 1;

/**
 * JSON has no date and no decimal. Dates become ISO strings and decimals become strings — not
 * numbers, because `17.50` out of `20` is a mark and a float is a rounding error waiting for a
 * regulator.
 */
function jsonSafe(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);

  if (typeof value === 'object') {
    // Prisma's Decimal, and anything else that models a number it refuses to lose precision on.
    // Called through the narrowed type rather than `String(value)`: the latter would silently
    // produce "[object Object]" for anything whose `toString` is Object's, which is precisely the
    // failure this branch exists to avoid.
    const decimal = value as { toFixed?: unknown; toString: () => string };

    if (typeof decimal.toFixed === 'function') {
      return decimal.toString();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, jsonSafe(item)]),
    );
  }

  return value;
}

function assemble(
  accountId: string,
  sections: Record<string, unknown[]>,
  notes: string[],
): DataExportBundle {
  const safe = Object.fromEntries(
    Object.entries(sections).map(([name, rows]) => [name, rows.map(jsonSafe)]),
  );

  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      accountId,
      // Every section, including the empty ones (FR-DSR-013). An absent section and an empty one
      // read identically to a person and mean very different things.
      counts: Object.fromEntries(Object.entries(safe).map(([name, rows]) => [name, rows.length])),
      notes,
    },
    sections: safe,
  };
}

const COMMON_NOTES = [
  'This file contains the data ConnectEd holds about one account. Dates are ISO 8601 (UTC); scores are strings so that no precision is lost.',
  'It deliberately contains no password hash, refresh token, two-factor secret or recovery code.',
];

/** An individual: a pupil, a parent, a teacher, a principal, or an account that is none of those. */
export async function buildIndividualBundle(db: Db, accountId: string): Promise<DataExportBundle> {
  const [
    account,
    profile,
    children,
    memberships,
    verificationRequests,
    academicItems,
    notices,
    assessments,
    marks,
    attendance,
    reportCards,
    leave,
    feedback,
    posts,
    comments,
    likes,
    follows,
    connections,
    messages,
    notifications,
    notificationPrefs,
    media,
    reportsRaised,
    productEvents,
  ] = await Promise.all([
    db.account.findUniqueOrThrow({
      where: { id: accountId },
      select: {
        id: true,
        type: true,
        email: true,
        emailVerifiedAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.userProfile.findUnique({
      where: { accountId },
      select: {
        fullName: true,
        handle: true,
        mobile: true,
        gender: true,
        dob: true,
        bio: true,
        achievements: true,
        displayPicKey: true,
        role: true,
        visibility: true,
        createdAt: true,
      },
    }),
    db.child.findMany({
      where: { parentAccountId: accountId },
      select: {
        id: true,
        fullName: true,
        schoolId: true,
        classId: true,
        studentAccountId: true,
        createdAt: true,
      },
    }),
    db.membership.findMany({
      where: { accountId },
      select: {
        schoolId: true,
        role: true,
        classId: true,
        childId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    // Rejections included. A refusal is a fact about the subject, and the one a subject access
    // request is most often actually asking about.
    db.verificationRequest.findMany({
      where: { requesterAccountId: accountId },
      select: {
        schoolId: true,
        role: true,
        classId: true,
        childId: true,
        status: true,
        decidedAt: true,
        createdAt: true,
      },
    }),
    db.academicItem.findMany({
      where: { authorAccountId: accountId },
      select: {
        id: true,
        type: true,
        classId: true,
        subjectId: true,
        title: true,
        body: true,
        imageKey: true,
        dueAt: true,
        createdAt: true,
      },
    }),
    db.notice.findMany({
      where: { authorAccountId: accountId },
      select: { id: true, schoolId: true, title: true, body: true, createdAt: true },
    }),
    db.assessment.findMany({
      where: { authorAccountId: accountId },
      select: {
        id: true,
        classId: true,
        subjectId: true,
        kind: true,
        title: true,
        maxScore: true,
        occurredOn: true,
        publishedAt: true,
      },
    }),
    /**
     * Marks **about** the subject, published only — an unpublished mark is a teacher's working
     * draft and does not exist for a pupil yet (FR-GRADE-011).
     *
     * `staffNote` is included, and that is not an oversight. The schema says of it in as many
     * words: "'Private' is not absolute, and the UI says so: a subject access request still
     * reaches it." This is that request. Private-from-the-family is a rule about the product's
     * screens, not a rule about what the product may be made to disclose about somebody.
     */
    db.mark.findMany({
      where: { studentAccountId: accountId, assessment: { publishedAt: { not: null } } },
      select: {
        score: true,
        remark: true,
        staffNote: true,
        createdAt: true,
        assessment: {
          select: { title: true, kind: true, maxScore: true, occurredOn: true, subjectId: true },
        },
      },
    }),
    db.attendanceEntry.findMany({
      where: { studentAccountId: accountId },
      select: { classId: true, onDate: true, state: true, leaveApplicationId: true },
    }),
    db.reportCard.findMany({
      where: { studentAccountId: accountId },
      select: {
        id: true,
        termId: true,
        classId: true,
        snapshot: true,
        comment: true,
        issuedAt: true,
        replacedIssuedAt: true,
      },
    }),
    db.leaveApplication.findMany({
      where: { applicantAccountId: accountId },
      select: {
        kind: true,
        schoolId: true,
        childId: true,
        startDate: true,
        endDate: true,
        reason: true,
        status: true,
        decidedAt: true,
        createdAt: true,
      },
    }),
    db.feedback.findMany({
      where: { authorAccountId: accountId },
      select: { kind: true, schoolId: true, body: true, status: true, createdAt: true },
    }),
    db.post.findMany({
      where: { authorAccountId: accountId },
      select: { id: true, body: true, imageKey: true, createdAt: true, deletedAt: true },
    }),
    db.postComment.findMany({
      where: { accountId },
      select: { postId: true, body: true, createdAt: true, deletedAt: true },
    }),
    db.postLike.findMany({ where: { accountId }, select: { postId: true, createdAt: true } }),
    db.follow.findMany({
      where: { OR: [{ followerAccountId: accountId }, { followeeAccountId: accountId }] },
      select: { followerAccountId: true, followeeAccountId: true, createdAt: true },
    }),
    db.connection.findMany({
      where: { OR: [{ aAccountId: accountId }, { bAccountId: accountId }] },
      select: {
        aAccountId: true,
        bAccountId: true,
        status: true,
        requestedBy: true,
        createdAt: true,
      },
    }),
    /**
     * **Only what the subject sent** (FR-DSR-011). The counterparty's handle comes along so the
     * subject can tell whom they were talking to; the counterparty's words do not, because they
     * were written to an audience of one person and not to that person's export file.
     */
    db.message.findMany({
      where: { senderAccountId: accountId },
      select: {
        body: true,
        createdAt: true,
        readAt: true,
        thread: {
          select: {
            a: { select: { id: true, userProfile: { select: { handle: true } } } },
            b: { select: { id: true, userProfile: { select: { handle: true } } } },
          },
        },
      },
    }),
    db.notification.findMany({
      where: { recipientAccountId: accountId },
      select: { type: true, payload: true, readAt: true, createdAt: true },
    }),
    db.notificationPref.findMany({ where: { accountId } }),
    db.mediaObject.findMany({
      where: { uploadedBy: accountId },
      select: { key: true, prefix: true, contentType: true, sizeBytes: true, createdAt: true },
    }),
    /**
     * Reports the subject **raised**. Not reports raised about them: those identify the reporter,
     * and the reporting form promises in as many words that nobody is told who complained.
     */
    db.report.findMany({
      where: { reporterAccountId: accountId },
      select: { subjectType: true, subjectId: true, reason: true, status: true, createdAt: true },
    }),
    /**
     * What the product recorded *about* the subject for its own analytics (S9-15).
     *
     * Included because a subject access request asks what is held, and "we counted when you were
     * active" is held. It is also the section most likely to surprise somebody, which is a reason
     * to show it rather than a reason not to.
     */
    db.productEvent.findMany({
      where: { accountId },
      select: { type: true, occurredAt: true, schoolId: true, payload: true },
      orderBy: { occurredAt: 'desc' },
    }),
  ]);

  return assemble(
    accountId,
    {
      account: [account],
      profile: profile ? [profile] : [],
      children,
      memberships,
      verificationRequests,
      academicItems,
      notices,
      assessments,
      marks,
      attendance,
      reportCards,
      leaveApplications: leave,
      feedback,
      posts,
      comments,
      likes,
      follows,
      connections,
      messagesSent: messages,
      notifications,
      notificationPrefs,
      media,
      reportsRaised,
      analyticsEvents: productEvents,
    },
    [
      ...COMMON_NOTES,
      'Messages are the ones you sent. The other party’s messages are their data, not yours, and are not included.',
      'Media lists the objects you uploaded, not the files themselves.',
    ],
  );
}

/**
 * A school (FR-DSR-012).
 *
 * The institution's own record: its profile, the structure it created, its notices and its
 * contract. **Not its pupils' data.** A school asking for "its data" and receiving four hundred
 * children's marks would be the single worst disclosure this feature could produce, and it is
 * prevented here by what is not queried rather than by a filter somewhere downstream.
 */
export async function buildSchoolBundle(db: Db, accountId: string): Promise<DataExportBundle> {
  const [account, profile, classes, subjects, terms, notices, events, subscription] =
    await Promise.all([
      db.account.findUniqueOrThrow({
        where: { id: accountId },
        select: {
          id: true,
          type: true,
          email: true,
          emailVerifiedAt: true,
          status: true,
          createdAt: true,
        },
      }),
      db.schoolProfile.findUnique({
        where: { accountId },
        select: {
          name: true,
          adminName: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          about: true,
          mission: true,
          vision: true,
          facilities: true,
          establishmentYear: true,
          affiliation: true,
          createdAt: true,
        },
      }),
      db.class.findMany({
        where: { schoolId: accountId },
        select: { id: true, medium: true, level: true, section: true, active: true },
      }),
      db.subject.findMany({
        where: { class: { schoolId: accountId } },
        select: { id: true, classId: true, name: true },
      }),
      db.term.findMany({
        where: { schoolId: accountId },
        select: { id: true, name: true, startDate: true, endDate: true },
      }),
      db.notice.findMany({
        where: { schoolId: accountId },
        select: { id: true, title: true, body: true, createdAt: true },
      }),
      db.event.findMany({
        where: { schoolId: accountId },
        select: { id: true, title: true, body: true, eventAt: true },
      }),
      db.subscription.findUnique({
        where: { schoolId: accountId },
        select: { planId: true, status: true, periodStart: true, periodEnd: true },
      }),
    ]);

  return assemble(
    accountId,
    {
      account: [account],
      profile: profile ? [profile] : [],
      classes,
      subjects,
      terms,
      notices,
      events,
      subscription: subscription ? [subscription] : [],
    },
    [
      ...COMMON_NOTES,
      'This is the institution’s own record. It does not contain members’ personal data — pupils, parents and staff each hold their own right to an export of theirs.',
    ],
  );
}
