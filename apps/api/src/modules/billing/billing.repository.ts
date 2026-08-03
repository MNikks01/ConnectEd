/**
 * Plans and subscriptions. **The only file in this module that touches Prisma.**
 */
import { PLAN_CATALOGUE } from './plan-catalogue.js';

import type { Db } from '../../shared/db/index.js';
import type { SubscriptionStatus } from '../../generated/prisma/client.js';

export interface SubscriptionRow {
  id: string;
  schoolId: string;
  status: SubscriptionStatus;
  periodStart: Date;
  periodEnd: Date;
  planCode: string;
  planName: string;
  /** Raw JSON as stored. The service parses it — a row written before a schema change must not
   * take down every read that touches it. */
  limits: unknown;
  features: unknown;
}

export interface BillingRepository {
  /** Idempotent. Called at startup and after a test reset; safe to run concurrently. */
  ensureCatalogue: () => Promise<void>;
  findSubscriptionBySchool: (schoolId: string) => Promise<SubscriptionRow | null>;
  countSchoolUsage: (schoolId: string) => Promise<{ classes: number; members: number }>;
}

const SUBSCRIPTION_SELECT = {
  id: true,
  schoolId: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  plan: { select: { code: true, name: true, limits: true, features: true } },
} as const;

export function createBillingRepository(db: Db): BillingRepository {
  return {
    ensureCatalogue: async () => {
      // Sequential rather than concurrent: three upserts are cheap, and two replicas booting at
      // once should contend on one row at a time rather than deadlock across three.
      for (const plan of PLAN_CATALOGUE) {
        await db.plan.upsert({
          where: { code: plan.code },
          // The code is the identity; everything else follows the catalogue, so an edit to a limit
          // takes effect on the next boot without a migration.
          update: { name: plan.name, limits: plan.limits, features: plan.features },
          create: {
            code: plan.code,
            name: plan.name,
            limits: plan.limits,
            features: plan.features,
          },
        });
      }
    },

    findSubscriptionBySchool: async (schoolId) => {
      const row = await db.subscription.findUnique({
        where: { schoolId },
        select: SUBSCRIPTION_SELECT,
      });

      if (!row) return null;

      return {
        id: row.id,
        schoolId: row.schoolId,
        status: row.status,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        planCode: row.plan.code,
        planName: row.plan.name,
        limits: row.plan.limits,
        features: row.plan.features,
      };
    },

    /**
     * What the school currently uses, against what its plan allows.
     *
     * Members are counted as **verified memberships**, not accounts: a pending request is not yet
     * a member of anything, and counting it would let a stranger push a school over its limit by
     * applying. Revoked and rejected memberships are excluded for the same reason.
     */
    countSchoolUsage: async (schoolId) => {
      const [classes, members] = await Promise.all([
        db.class.count({ where: { schoolId } }),
        db.membership.count({ where: { schoolId, status: 'VERIFIED' } }),
      ]);

      return { classes, members };
    },
  };
}
