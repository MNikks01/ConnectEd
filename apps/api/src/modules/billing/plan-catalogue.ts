/**
 * The plan catalogue — S5-1 (`PRD/08-billing.md`).
 *
 * **These numbers are provisional.** `PRD/08-billing.md` names the *shape* of a plan (max classes,
 * max members, advanced analytics) and deliberately leaves the values to product; S5-0b in
 * `Sprint/05-sprint-5.md` is the open decision. What is written here is a defensible first cut so
 * the enforcement machinery can be built and tested, **not** a pricing decision. Changing a number
 * is a one-line edit here and a restart — the table follows the code, never the other way round.
 *
 * The catalogue lives in TypeScript rather than a data migration for one reason: it must be
 * present in *every* environment, including a test database that truncates every table between
 * cases. `ensureCatalogue` reapplies it, so "the plans exist" is an invariant of the code rather
 * than a thing someone remembered to run.
 */
import { z } from 'zod';

/**
 * `null` means unlimited, and it means it deliberately: a very large number would eventually be
 * hit by a real school and produce a confusing refusal, whereas `null` is a claim the enforcement
 * code has to handle explicitly.
 */
export const planLimitsSchema = z.object({
  classes: z.number().int().positive().nullable(),
  members: z.number().int().positive().nullable(),
});

export const planFeaturesSchema = z.object({
  advancedAnalytics: z.boolean(),
});

export type PlanLimits = z.infer<typeof planLimitsSchema>;
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;

export interface PlanDefinition {
  code: string;
  name: string;
  limits: PlanLimits;
  features: PlanFeatures;
}

/** How long a new school's trial runs (FR-BILL-001). */
export const TRIAL_DAYS = 30;

/**
 * The plan every school starts on, and the floor a cancelled subscription falls back to.
 *
 * Those two being the same plan is a decision, not a coincidence: a school that stops paying keeps
 * what a school that has never paid gets. It does not lose its data (see `resolveEntitlements`),
 * and it is not pushed below the level at which the product is usable at all.
 */
export const TRIAL_PLAN_CODE = 'trial';

export const PLAN_CATALOGUE: readonly PlanDefinition[] = [
  {
    code: TRIAL_PLAN_CODE,
    name: 'Trial',
    // Enough for a school to run a real class or two and decide, not enough to run a school on.
    limits: { classes: 5, members: 200 },
    features: { advancedAnalytics: false },
  },
  {
    code: 'standard',
    name: 'Standard',
    limits: { classes: 40, members: 1500 },
    features: { advancedAnalytics: false },
  },
  {
    code: 'premium',
    name: 'Premium',
    limits: { classes: null, members: null },
    features: { advancedAnalytics: true },
  },
];

export function planDefinition(code: string): PlanDefinition | undefined {
  return PLAN_CATALOGUE.find((plan) => plan.code === code);
}
