/**
 * The moderation queue. **The only file in this module that touches Prisma.**
 *
 * Reads across every content type a report can name, which is the one place in this API where a
 * polymorphic subject id has to be resolved. `ReadReceipt` models subjects the same way and never
 * needed to; here a reviewer cannot judge a report without seeing the thing.
 */
import { BOUNDED_LIST_CAP } from '../../shared/http/pagination.js';

import type { Db } from '../../shared/db/index.js';
import type { ReportStatus, ReportSubject } from '../../generated/prisma/client.js';

export interface QueuedReportRow {
  id: string;
  status: ReportStatus;
  reason: string;
  createdAt: Date;
  reviewedAt: Date | null;
  subjectType: ReportSubject;
  subjectId: string;
  reportCount: number;
}

export interface SubjectRow {
  excerpt: string | null;
  authorAccountId: string | null;
  authorDisplayName: string | null;
  removed: boolean;
}

export interface ModerationQueueRepository {
  list: (status: ReportStatus | undefined) => Promise<QueuedReportRow[]>;
  findById: (id: string) => Promise<QueuedReportRow | null>;
  /** The reported thing itself, or `null` when it never existed. */
  resolveSubject: (type: ReportSubject, id: string) => Promise<SubjectRow | null>;
  decide: (input: {
    reportId: string;
    reviewerAccountId: string;
    status: ReportStatus;
    note?: string | undefined;
  }) => Promise<void>;
  /** Soft-deletes the reported content. Messages and accounts are out of scope — see the service. */
  removeSubject: (type: ReportSubject, id: string) => Promise<boolean>;
}

const REPORT_SELECT = {
  id: true,
  status: true,
  reason: true,
  createdAt: true,
  reviewedAt: true,
  subjectType: true,
  subjectId: true,
} as const;

export function createModerationQueueRepository(db: Db): ModerationQueueRepository {
  /**
   * How many separate people reported this same thing.
   *
   * Counted rather than joined: the queue lists one row per report, and a reviewer looking at one
   * of them wants to know that four other people agree. `@@unique([reporter, type, id])` means
   * this is a count of people, not of clicks.
   */
  async function countFor(type: ReportSubject, id: string): Promise<number> {
    return db.report.count({ where: { subjectType: type, subjectId: id } });
  }

  async function decorate(
    rows: { subjectType: ReportSubject; subjectId: string }[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    await Promise.all(
      [...new Set(rows.map((row) => `${row.subjectType}:${row.subjectId}`))].map(async (key) => {
        const [type, id] = key.split(':') as [ReportSubject, string];
        counts.set(key, await countFor(type, id));
      }),
    );

    return counts;
  }

  return {
    list: async (status) => {
      const rows = await db.report.findMany({
        where: status ? { status } : {},
        select: REPORT_SELECT,
        // Oldest first, unlike every other list in this API. A queue is worked from the front:
        // newest-first would leave the oldest complaint permanently at the bottom.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: BOUNDED_LIST_CAP,
      });

      const counts = await decorate(rows);

      return rows.map((row) => ({
        ...row,
        reportCount: counts.get(`${row.subjectType}:${row.subjectId}`) ?? 1,
      }));
    },

    findById: async (id) => {
      const row = await db.report.findUnique({ where: { id }, select: REPORT_SELECT });
      if (!row) return null;

      return { ...row, reportCount: await countFor(row.subjectType, row.subjectId) };
    },

    resolveSubject: async (type, id) => {
      switch (type) {
        case 'POST': {
          const post = await db.post.findUnique({
            where: { id },
            select: {
              body: true,
              deletedAt: true,
              authorAccountId: true,
              author: { select: { userProfile: { select: { fullName: true } } } },
            },
          });
          if (!post) return null;
          return {
            excerpt: post.body,
            authorAccountId: post.authorAccountId,
            authorDisplayName: post.author.userProfile?.fullName ?? null,
            removed: post.deletedAt !== null,
          };
        }
        case 'COMMENT': {
          const comment = await db.postComment.findUnique({
            where: { id },
            select: {
              body: true,
              deletedAt: true,
              accountId: true,
              account: { select: { userProfile: { select: { fullName: true } } } },
            },
          });
          if (!comment) return null;
          return {
            excerpt: comment.body,
            authorAccountId: comment.accountId,
            authorDisplayName: comment.account.userProfile?.fullName ?? null,
            removed: comment.deletedAt !== null,
          };
        }
        case 'MESSAGE': {
          const message = await db.message.findUnique({
            where: { id },
            select: {
              senderAccountId: true,
              sender: { select: { userProfile: { select: { fullName: true } } } },
            },
          });
          if (!message) return null;
          // The body is deliberately absent. A private message between two people is not made
          // public by one of them reporting it — a reviewer gets the sender and the reporter's
          // description of what was said, which is enough to act on an account.
          return {
            excerpt: null,
            authorAccountId: message.senderAccountId,
            authorDisplayName: message.sender.userProfile?.fullName ?? null,
            removed: false,
          };
        }
        case 'ACCOUNT': {
          const account = await db.account.findUnique({
            where: { id },
            select: {
              status: true,
              userProfile: { select: { fullName: true } },
              schoolProfile: { select: { name: true } },
            },
          });
          if (!account) return null;
          return {
            excerpt: null,
            authorAccountId: id,
            authorDisplayName: account.userProfile?.fullName ?? account.schoolProfile?.name ?? null,
            removed: account.status !== 'ACTIVE',
          };
        }
        default:
          return null;
      }
    },

    decide: async ({ reportId, reviewerAccountId, status, note }) => {
      await db.$transaction([
        db.report.update({
          where: { id: reportId },
          data: { status, reviewedBy: reviewerAccountId, reviewedAt: new Date() },
        }),
        db.auditLog.create({
          data: {
            actorAccountId: reviewerAccountId,
            action: 'report.decided',
            entity: 'report',
            entityId: reportId,
            metadata: { status, ...(note ? { note } : {}) },
          },
        }),
      ]);
    },

    removeSubject: async (type, id) => {
      const now = new Date();

      if (type === 'POST') {
        const result = await db.post.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: now },
        });
        return result.count > 0;
      }

      if (type === 'COMMENT') {
        const result = await db.postComment.updateMany({
          where: { id, deletedAt: null },
          data: { deletedAt: now },
        });
        return result.count > 0;
      }

      return false;
    },
  };
}
