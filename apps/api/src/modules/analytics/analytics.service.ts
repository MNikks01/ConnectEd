/**
 * School analytics — S6-7 (`PRD/08-billing.md`, `advancedAnalytics`).
 *
 * Two checks, in this order, and the order is the point:
 *
 * 1. **`assertIsSchool`** — is this your school? 404 for anyone else, so the endpoint cannot be
 *    used to discover which schools exist.
 * 2. **`assertFeature`** — does your plan include this? A 402 that names the feature and the plan
 *    that has it.
 *
 * Authorization before entitlement, always. A 402 for someone else's school would confirm that
 * school exists and volunteer what it pays for.
 */
import { assertIsSchool } from '../../shared/authz/index.js';

import type { AnalyticsRepository } from './analytics.repository.js';
import type { Actor } from '../../shared/authz/index.js';
import type { SchoolAnalyticsResponse } from '@connected/types';

/** The slice of billing this module needs: may this school see a paid feature? */
export interface FeatureGuard {
  assertFeature: (schoolId: string, feature: 'advancedAnalytics') => Promise<void>;
}

export interface AnalyticsService {
  forSchool: (actor: Actor, schoolId: string, days: number) => Promise<SchoolAnalyticsResponse>;
}

export interface AnalyticsServiceDeps {
  repository: AnalyticsRepository;
  entitlements: FeatureGuard;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A rate, or `null` when there was nothing to read.
 *
 * `null` rather than 0: a school that published no notices has no read-rate, and 0% would read as
 * a failure rather than as an absence. The same distinction the billing page makes between a limit
 * of zero and no limit at all.
 */
function rate(reads: number, published: number, audience: number): number | null {
  const possible = published * audience;
  if (possible === 0) return null;

  // Capped at 1: a member verified after a notice was published can still read it, so reads can
  // exceed the audience size at the moment of measurement. A rate above 100% is a distraction,
  // not a finding.
  return Math.min(1, reads / possible);
}

export function createAnalyticsService({
  repository,
  entitlements,
}: AnalyticsServiceDeps): AnalyticsService {
  return {
    forSchool: async (actor, schoolId, days) => {
      assertIsSchool(actor, schoolId);
      await entitlements.assertFeature(schoolId, 'advancedAnalytics');

      const to = new Date();
      const from = new Date(to.getTime() - days * DAY_MS);
      const row = await repository.gather({ schoolId, from });

      return {
        window: { days, from: from.toISOString(), to: to.toISOString() },
        membership: { total: row.verifiedMembers, byRole: row.membershipByRole },
        structure: { classes: row.classes, subjects: row.subjects },
        publishing: {
          academicItems: row.academicItemsByType,
          notices: row.notices,
          events: row.events,
        },
        engagement: {
          noticeReadRate: rate(row.noticeReads, row.notices, row.verifiedMembers),
          academicReadRate: rate(
            row.academicReads,
            Object.values(row.academicItemsByType).reduce((sum, n) => sum + n, 0),
            row.verifiedMembers,
          ),
          verifiedMembers: row.verifiedMembers,
        },
        workflows: { leaveByStatus: row.leaveByStatus, feedbackByStatus: row.feedbackByStatus },
      };
    },
  };
}
