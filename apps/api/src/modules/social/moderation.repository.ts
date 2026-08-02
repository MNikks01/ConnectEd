/**
 * Blocks and reports. **The only file in this pair that touches Prisma.**
 */
import { BOUNDED_LIST_CAP } from '../../shared/http/pagination.js';

import type { CardRow } from './graph.repository.js';
import type { Db } from '../../shared/db/index.js';
import type { ReportStatus, ReportSubject } from '../../generated/prisma/client.js';

export interface ReportRow {
  id: string;
  subjectType: ReportSubject;
  subjectId: string;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
}

export interface ModerationRepository {
  block: (blockerAccountId: string, blockedAccountId: string) => Promise<void>;
  unblock: (blockerAccountId: string, blockedAccountId: string) => Promise<void>;
  isBlockedBy: (blockerAccountId: string, blockedAccountId: string) => Promise<boolean>;
  /** Who *this* account has blocked. Never who has blocked them. */
  listBlocked: (accountId: string) => Promise<CardRow[]>;
  report: (input: {
    reporterAccountId: string;
    subjectType: ReportSubject;
    subjectId: string;
    reason: string;
  }) => Promise<ReportRow>;
  listMyReports: (accountId: string) => Promise<ReportRow[]>;
  /** Whether the thing being reported exists, so a report cannot name nothing. */
  subjectExists: (subjectType: ReportSubject, subjectId: string) => Promise<boolean>;
}

const ACCOUNT_CARD = {
  select: {
    id: true,
    type: true,
    userProfile: { select: { fullName: true, handle: true, displayPicKey: true } },
    schoolProfile: { select: { name: true, displayPicKey: true } },
  },
} as const;

interface RawAccount {
  id: string;
  type: string;
  userProfile: { fullName: string; handle: string; displayPicKey: string | null } | null;
  schoolProfile: { name: string; displayPicKey: string | null } | null;
}

function toCard(raw: RawAccount): CardRow {
  return {
    accountId: raw.id,
    accountType: raw.type === 'SCHOOL' ? 'SCHOOL' : 'INDIVIDUAL',
    displayName: raw.userProfile?.fullName ?? raw.schoolProfile?.name ?? 'Someone',
    handle: raw.userProfile?.handle ?? null,
    displayPicKey: raw.userProfile?.displayPicKey ?? raw.schoolProfile?.displayPicKey ?? null,
  };
}

const REPORT_SELECT = {
  id: true,
  subjectType: true,
  subjectId: true,
  reason: true,
  status: true,
  createdAt: true,
} as const;

export function createModerationRepository(db: Db): ModerationRepository {
  return {
    block: async (blockerAccountId, blockedAccountId) => {
      // Idempotent: blocking twice is blocking once, and should not be an error to special-case.
      await db.block.upsert({
        where: {
          blockerAccountId_blockedAccountId: { blockerAccountId, blockedAccountId },
        },
        update: {},
        create: { blockerAccountId, blockedAccountId },
      });
    },

    unblock: async (blockerAccountId, blockedAccountId) => {
      await db.block.deleteMany({ where: { blockerAccountId, blockedAccountId } });
    },

    isBlockedBy: async (blockerAccountId, blockedAccountId) =>
      (await db.block.count({ where: { blockerAccountId, blockedAccountId } })) > 0,

    listBlocked: async (accountId) => {
      const rows = await db.block.findMany({
        where: { blockerAccountId: accountId },
        select: { blocked: ACCOUNT_CARD },
        orderBy: { createdAt: 'desc' },
        take: BOUNDED_LIST_CAP,
      });

      return rows.map((row) => toCard(row.blocked));
    },

    report: async (input) =>
      db.report.upsert({
        // One report per person per thing: reporting twice is the same complaint, not two, and the
        // second attempt should not fail in the reporter's face.
        where: {
          reporterAccountId_subjectType_subjectId: {
            reporterAccountId: input.reporterAccountId,
            subjectType: input.subjectType,
            subjectId: input.subjectId,
          },
        },
        update: { reason: input.reason },
        create: input,
        select: REPORT_SELECT,
      }),

    listMyReports: async (accountId) =>
      db.report.findMany({
        where: { reporterAccountId: accountId },
        select: REPORT_SELECT,
        orderBy: { createdAt: 'desc' },
        take: BOUNDED_LIST_CAP,
      }),

    /**
     * Checked so a report cannot name something that does not exist — otherwise the queue fills
     * with rows nobody can act on, and a reporter gets no signal that they reported nothing.
     *
     * Soft-deleted content still counts: a report about a post someone deleted is exactly the case
     * moderation most needs.
     */
    subjectExists: async (subjectType, subjectId) => {
      switch (subjectType) {
        case 'POST':
          return (await db.post.count({ where: { id: subjectId } })) > 0;
        case 'COMMENT':
          return (await db.postComment.count({ where: { id: subjectId } })) > 0;
        case 'MESSAGE':
          return (await db.message.count({ where: { id: subjectId } })) > 0;
        case 'ACCOUNT':
          return (await db.account.count({ where: { id: subjectId } })) > 0;
        default:
          return false;
      }
    },
  };
}
