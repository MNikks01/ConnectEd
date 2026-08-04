/**
 * Billing DTOs (`.docs/PRD/08-billing.md`).
 *
 * A subscription answers two different questions and the DTO keeps them apart: **what the school
 * bought** (plan, status, period) and **what it may currently do** (limits, and usage against
 * them). The second is what the API enforces; the first is what a bill is raised against.
 */

export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';

/** `null` means unlimited. See `plan-catalogue.ts` for why it is not a very large number. */
export interface PlanLimitsResponse {
  classes: number | null;
  members: number | null;
}

export interface PlanFeaturesResponse {
  advancedAnalytics: boolean;
}

/**
 * Usage is returned beside the limit it is measured against, because a limit on its own is not
 * actionable: "40 classes" tells a school nothing until it knows it has 39.
 */
export interface UsageResponse {
  classes: number;
  members: number;
}

export interface SubscriptionResponse {
  planCode: string;
  planName: string;
  /** `null` when the school has no subscription on record — see `entitlementsFor`. */
  status: SubscriptionStatus | null;
  periodStart: string | null;
  periodEnd: string | null;
  limits: PlanLimitsResponse;
  features: PlanFeaturesResponse;
  usage: UsageResponse;
}
