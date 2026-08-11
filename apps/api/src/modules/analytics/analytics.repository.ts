/**
 * School analytics. **The only file in this module that touches Prisma.**
 *
 * Every figure is a `groupBy` or a `count` over tables that already exist — no rollup table, no
 * nightly job, no separate store. That is what made this buildable in a sprint, and it is also why
 * the numbers are current rather than as of last night. It will stop being the right shape when a
 * school has years of history rather than months; the fix then is a materialised rollup, and this
 * module's interface will not have to change for it.
 */
import type { Db } from '../../shared/db/index.js';

export interface AnalyticsWindowInput {
  schoolId: string;
  from: Date;
}

export interface AnalyticsRow {
  membershipByRole: Record<string, number>;
  classes: number;
  subjects: number;
  academicItemsByType: Record<string, number>;
  notices: number;
  events: number;
  noticeReads: number;
  academicReads: number;
  verifiedMembers: number;
  weeklyActiveMembers: number;
  historyFrom: string;
  leaveByStatus: Record<string, number>;
  feedbackByStatus: Record<string, number>;
}

export interface AnalyticsRepository {
  gather: (input: AnalyticsWindowInput) => Promise<AnalyticsRow>;
}

function tally<T extends string>(
  rows: { _count: { _all: number } }[],
  key: (row: never) => T,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[key(row as never)] = row._count._all;
  return out;
}

export function createAnalyticsRepository(db: Db): AnalyticsRepository {
  return {
    gather: async ({ schoolId, from }) => {
      // "Weekly active" is defined as a week, whatever window the rest of the page is showing.
      // Rescaling it to a 90-day selector would produce a number with the same name and a
      // different meaning, which is how a dashboard starts lying quietly.
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Concurrent because they are independent reads on a pool, not statements in one
      // transaction. A school's dashboard is one request; eleven sequential round trips would be
      // eleven times the latency for no consistency the reader could perceive.
      const [
        membership,
        classes,
        subjects,
        academicItems,
        notices,
        events,
        noticeReads,
        academicReads,
        leave,
        feedback,
        weeklyActive,
        earliestEvent,
      ] = await Promise.all([
        db.membership.groupBy({
          by: ['role'],
          where: { schoolId, status: 'VERIFIED' },
          _count: { _all: true },
        }),
        db.class.count({ where: { schoolId } }),
        db.subject.count({ where: { class: { schoolId } } }),
        db.academicItem.groupBy({
          by: ['type'],
          where: { class: { schoolId }, deletedAt: null, createdAt: { gte: from } },
          _count: { _all: true },
        }),
        db.notice.count({ where: { schoolId, deletedAt: null, createdAt: { gte: from } } }),
        db.event.count({ where: { schoolId, deletedAt: null, createdAt: { gte: from } } }),
        // Read receipts carry a loose subject id, so the join is a subquery on the ids in range
        // rather than a relation. Counted distinctly by construction: the receipt table is unique
        // on (subjectType, subjectId, accountId), so one person reading twice is one row.
        db.readReceipt.count({
          where: {
            subjectType: 'NOTICE',
            subjectId: {
              in: (
                await db.notice.findMany({
                  where: { schoolId, deletedAt: null, createdAt: { gte: from } },
                  select: { id: true },
                })
              ).map((row) => row.id),
            },
          },
        }),
        db.readReceipt.count({
          where: {
            subjectType: 'ACADEMIC_ITEM',
            subjectId: {
              in: (
                await db.academicItem.findMany({
                  where: { class: { schoolId }, deletedAt: null, createdAt: { gte: from } },
                  select: { id: true },
                })
              ).map((row) => row.id),
            },
          },
        }),
        db.leaveApplication.groupBy({
          by: ['status'],
          where: { schoolId, createdAt: { gte: from } },
          _count: { _all: true },
        }),
        db.feedback.groupBy({
          by: ['status'],
          where: { schoolId, createdAt: { gte: from } },
          _count: { _all: true },
        }),
        /**
         * The north star (S9-15). Distinct accounts with an `account.active` row in the last
         * seven days, restricted to this school's verified members — a person active at another
         * school is not this school's active member.
         *
         * Seven days regardless of the window the rest of the page is showing: "weekly active" is
         * defined as a week, and rescaling it to a 90-day selector would produce a number with the
         * same name and a different meaning.
         */
        db.productEvent.findMany({
          where: {
            type: 'account.active',
            occurredAt: { gte: weekAgo },
            accountId: {
              in: (
                await db.membership.findMany({
                  where: { schoolId, status: 'VERIFIED' },
                  select: { accountId: true },
                  distinct: ['accountId'],
                })
              ).map((row) => row.accountId),
            },
          },
          select: { accountId: true },
          distinct: ['accountId'],
        }),
        /** The earliest thing recorded, so the figure can say how much history it has. */
        db.productEvent.findFirst({
          orderBy: { occurredAt: 'asc' },
          select: { occurredAt: true },
        }),
      ]);

      const membershipByRole = tally(membership, (row: { role: string }) => row.role);
      const verifiedMembers = Object.values(membershipByRole).reduce((sum, n) => sum + n, 0);

      return {
        membershipByRole,
        classes,
        subjects,
        academicItemsByType: tally(academicItems, (row: { type: string }) => row.type),
        notices,
        events,
        noticeReads,
        academicReads,
        verifiedMembers,
        weeklyActiveMembers: weeklyActive.length,
        historyFrom: (earliestEvent?.occurredAt ?? weekAgo).toISOString(),
        leaveByStatus: tally(leave, (row: { status: string }) => row.status),
        feedbackByStatus: tally(feedback, (row: { status: string }) => row.status),
      };
    },
  };
}
