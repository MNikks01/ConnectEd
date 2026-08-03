/**
 * Billing domain logic and entitlement resolution — S5-1, S5-2 (`PRD/08-billing.md`).
 *
 * Every other module in this API answers **"may you?"** — role, verification, ownership. This one
 * answers a different question: **"has this school paid for it?"** They must not be conflated. A
 * teacher refused by an authorization policy did something they were not allowed to do; a teacher
 * refused by an entitlement did nothing wrong at all, and their school has a decision to make.
 */
import {
  planFeaturesSchema,
  planLimitsSchema,
  TRIAL_DAYS,
  TRIAL_PLAN_CODE,
  planDefinition,
} from './plan-catalogue.js';

import { assertIsSchool } from '../../shared/authz/index.js';
import { PlanLimitExceededError } from '../../shared/errors/index.js';

import type { Actor } from '../../shared/authz/index.js';
import type { BillingRepository, SubscriptionRow } from './billing.repository.js';
import type { PlanFeatures, PlanLimits } from './plan-catalogue.js';
import type { Logger } from '../../shared/logger/index.js';
import type { SubscriptionStatus } from '../../generated/prisma/client.js';
import type { SubscriptionResponse } from '@connected/types';

/** What a school may currently do. The resolved answer, after status has been applied to plan. */
export interface Entitlements {
  planCode: string;
  planName: string;
  /** `null` when the school has no subscription row at all. */
  status: SubscriptionStatus | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  limits: PlanLimits;
  features: PlanFeatures;
}

/** The terms of a new school's trial. Plain data, so no other module needs Prisma to apply it. */
export interface TrialTerms {
  planCode: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface BillingService {
  ensureCatalogue: () => Promise<void>;
  /** FR-BILL-001. Read by whoever creates the school, in the same transaction. */
  trialTerms: (now?: Date) => TrialTerms;
  /**
   * Internal: what a school may do, for other modules to enforce against. Takes no actor because
   * it is not a permission — the answer is the same whoever is asking, and the caller has already
   * established that this person may act for this school.
   */
  entitlementsFor: (schoolId: string) => Promise<Entitlements>;
  /** The school's own view of its subscription. Authorized: only the school itself. */
  subscriptionFor: (actor: Actor, schoolId: string) => Promise<SubscriptionResponse>;
  /**
   * FR-BILL-003. Throws `PlanLimitExceededError` when the school has no room left under `limit`.
   *
   * Throws rather than returning a boolean, for the same reason the authz policies do: a boolean
   * invites `if (canAdd(...)) {}` with a forgotten `else`, and a forgotten `else` here is a limit
   * that silently does not apply.
   */
  assertWithinLimit: (schoolId: string, limit: LimitName) => Promise<void>;
}

/** The limits the API enforces. Named so a typo is a compile error rather than a missing check. */
export type LimitName = 'classes' | 'members';

export interface BillingServiceDeps {
  repository: BillingRepository;
  logger: Logger;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The floor: what a school gets with no paid plan behind it.
 *
 * A cancelled subscription resolves here rather than to nothing. Cancelling must not read as
 * deleting — the school keeps every class and member it already has (enforcement happens at the
 * write that would *exceed* a limit, never retroactively), it simply cannot add beyond the free
 * level until it subscribes again.
 */
function floor(): { limits: PlanLimits; features: PlanFeatures; code: string; name: string } {
  const trial = planDefinition(TRIAL_PLAN_CODE);

  if (!trial) {
    // Unreachable unless the catalogue is edited to remove its own floor. Fail loudly rather than
    // silently granting nothing — a school locked out of its own timetable by a typo in a
    // constant is a far worse failure than a crash at boot.
    throw new Error(`Plan catalogue has no "${TRIAL_PLAN_CODE}" plan to fall back to.`);
  }

  return { limits: trial.limits, features: trial.features, code: trial.code, name: trial.name };
}

export function createBillingService({ repository, logger }: BillingServiceDeps): BillingService {
  /**
   * Plan limits are stored as JSON, so a row can outlive the shape the code expects — a plan
   * written by an older deploy, or edited by hand in an incident. Parsing here means one bad row
   * degrades that school to the floor instead of throwing on every request that consults it.
   */
  function parsePlan(row: SubscriptionRow): { limits: PlanLimits; features: PlanFeatures } {
    const limits = planLimitsSchema.safeParse(row.limits);
    const features = planFeaturesSchema.safeParse(row.features);

    if (!limits.success || !features.success) {
      logger.error(
        { schoolId: row.schoolId, planCode: row.planCode },
        'Plan row does not match the catalogue schema; falling back to the free floor',
      );
      const fallback = floor();
      return { limits: fallback.limits, features: fallback.features };
    }

    return { limits: limits.data, features: features.data };
  }

  async function resolve(schoolId: string): Promise<Entitlements> {
    const row = await repository.findSubscriptionBySchool(schoolId);

    if (!row) {
      // Every school registered since S5-2 has a subscription created in the same transaction as
      // the school itself, so this is either a row predating that or a bug. Either way the school
      // is a customer and must keep working: give it the floor and say so once, loudly.
      logger.warn({ schoolId }, 'School has no subscription; resolving entitlements to the floor');
      const fallback = floor();

      return {
        planCode: fallback.code,
        planName: fallback.name,
        status: null,
        periodStart: null,
        periodEnd: null,
        limits: fallback.limits,
        features: fallback.features,
      };
    }

    const parsed = parsePlan(row);

    /**
     * `PAST_DUE` keeps full entitlements on purpose. A failed payment is very often an expired
     * card, and cutting a school off from its own timetable the morning a renewal bounces would
     * punish the wrong people. The grace period, and what happens when it runs out, is dunning
     * (S5-6, FR-BILL-005).
     */
    if (row.status === 'CANCELED') {
      const fallback = floor();

      return {
        planCode: fallback.code,
        planName: fallback.name,
        status: row.status,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        limits: fallback.limits,
        features: fallback.features,
      };
    }

    return {
      planCode: row.planCode,
      planName: row.planName,
      status: row.status,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      limits: parsed.limits,
      features: parsed.features,
    };
  }

  return {
    ensureCatalogue: () => repository.ensureCatalogue(),

    trialTerms: (now = new Date()) => ({
      planCode: TRIAL_PLAN_CODE,
      periodStart: now,
      periodEnd: new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
    }),

    entitlementsFor: resolve,

    /**
     * Checked **at the write that would exceed the limit**, never retroactively.
     *
     * That is the whole design. A school on a plan capped at ten classes that already has fifty —
     * because it downgraded, or because the cap was lowered — keeps all fifty. Enforcing on read,
     * or reconciling downwards on a status change, would mean a school losing access to its own
     * timetable the morning a card expired, which is a far worse product than one that occasionally
     * has a customer above their tier.
     *
     * **Concurrency:** two simultaneous creates at limit-1 can both pass, leaving a school one
     * over. That is deliberate rather than overlooked — a plan limit is a commercial guardrail, not
     * a security boundary, and serialising every school-scoped write behind a lock on the
     * subscription row would cost far more than one extra class is worth. If it ever needs to be
     * exact, the fix is to take that lock in the same transaction as the insert.
     */
    assertWithinLimit: async (schoolId, limit) => {
      const [entitlements, usage] = await Promise.all([
        resolve(schoolId),
        repository.countSchoolUsage(schoolId),
      ]);

      const allowed = entitlements.limits[limit];
      // `null` is unlimited, and is checked explicitly: `!allowed` would also be true of 0.
      if (allowed === null) return;

      if (usage[limit] >= allowed) {
        throw new PlanLimitExceededError({
          limit,
          allowed,
          used: usage[limit],
          planName: entitlements.planName,
        });
      }
    },

    subscriptionFor: async (actor, schoolId) => {
      // A school's commercial position is its own business, and nobody else's: not its principal,
      // not another school. `assertIsSchool` 404s rather than 403s for a school asking about
      // someone else, so the route cannot be used to discover which schools exist.
      assertIsSchool(actor, schoolId);

      const [entitlements, usage] = await Promise.all([
        resolve(schoolId),
        repository.countSchoolUsage(schoolId),
      ]);

      return {
        planCode: entitlements.planCode,
        planName: entitlements.planName,
        status: entitlements.status,
        periodStart: entitlements.periodStart?.toISOString() ?? null,
        periodEnd: entitlements.periodEnd?.toISOString() ?? null,
        limits: entitlements.limits,
        features: entitlements.features,
        usage,
      };
    },
  };
}
