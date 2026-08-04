/**
 * Complaint and suggestion persistence. **The only file in this pair that touches Prisma.**
 */
import { BOUNDED_LIST_CAP } from '../../shared/http/pagination.js';

import type { Db } from '../../shared/db/index.js';
import type { FeedbackKind, FeedbackStatus } from '../../generated/prisma/client.js';

export interface FeedbackRow {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  schoolId: string;
  body: string;
  authorAccountId: string;
  authorName: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface FeedbackRepository {
  create: (input: {
    kind: FeedbackKind;
    schoolId: string;
    authorAccountId: string;
    body: string;
  }) => Promise<FeedbackRow>;
  findById: (id: string) => Promise<FeedbackRow | null>;
  listForSchool: (schoolId: string, status: FeedbackStatus | undefined) => Promise<FeedbackRow[]>;
  listForAuthor: (accountId: string) => Promise<FeedbackRow[]>;
  review: (input: {
    id: string;
    status: FeedbackStatus;
    reviewedBy: string;
  }) => Promise<FeedbackRow>;
}

const SELECT = {
  id: true,
  kind: true,
  status: true,
  schoolId: true,
  body: true,
  authorAccountId: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  author: { select: { userProfile: { select: { fullName: true } } } },
} as const;

interface RawFeedback {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  schoolId: string;
  body: string;
  authorAccountId: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  author: { userProfile: { fullName: string } | null } | null;
}

function toRow(raw: RawFeedback): FeedbackRow {
  return {
    id: raw.id,
    kind: raw.kind,
    status: raw.status,
    schoolId: raw.schoolId,
    body: raw.body,
    authorAccountId: raw.authorAccountId,
    authorName: raw.author?.userProfile?.fullName ?? null,
    reviewedBy: raw.reviewedBy,
    reviewedAt: raw.reviewedAt,
    createdAt: raw.createdAt,
  };
}

export function createFeedbackRepository(db: Db): FeedbackRepository {
  return {
    create: async (input) => toRow(await db.feedback.create({ data: input, select: SELECT })),

    findById: async (id) => {
      const row = await db.feedback.findUnique({ where: { id }, select: SELECT });
      return row ? toRow(row) : null;
    },

    listForSchool: async (schoolId, status) => {
      const rows = await db.feedback.findMany({
        where: { schoolId, ...(status ? { status } : {}) },
        select: SELECT,
        // Oldest first: this is a queue to work through, not a feed to scroll.
        orderBy: { createdAt: 'asc' },
        take: BOUNDED_LIST_CAP,
      });
      return rows.map(toRow);
    },

    listForAuthor: async (accountId) => {
      const rows = await db.feedback.findMany({
        where: { authorAccountId: accountId },
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        take: BOUNDED_LIST_CAP,
      });
      return rows.map(toRow);
    },

    review: async ({ id, status, reviewedBy }) =>
      toRow(
        await db.feedback.update({
          where: { id },
          data: { status, reviewedBy, reviewedAt: new Date() },
          select: SELECT,
        }),
      ),
  };
}
