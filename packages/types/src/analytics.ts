/**
 * School analytics DTOs (`.docs/PRD/08-billing.md`, `advancedAnalytics`).
 *
 * Everything here is derived from data the school already has. Nothing is stored, nothing is
 * recomputed on a schedule, and there is no separate analytics store — which is why this could be
 * built at all without a data pipeline, and why the numbers are always current rather than as of
 * last night.
 */

/** The window every count below is measured over. */
export interface AnalyticsWindow {
  days: number;
  from: string;
  to: string;
}

export interface MembershipBreakdown {
  total: number;
  /** Verified memberships by role. Pending and revoked are not members. */
  byRole: Record<string, number>;
}

export interface StructureBreakdown {
  classes: number;
  subjects: number;
}

export interface PublishingBreakdown {
  /** Academic items by type — homework, assignments, projects. */
  academicItems: Record<string, number>;
  notices: number;
  events: number;
}

/**
 * How much of what was published was actually opened.
 *
 * `null` rather than `0` when nothing was published: a school that posted no notices has no
 * read-rate, and showing it as 0% would read as a failure rather than as an absence.
 */
export interface EngagementBreakdown {
  noticeReadRate: number | null;
  academicReadRate: number | null;
  /** The denominator, stated — a rate whose base is invisible cannot be argued with. */
  verifiedMembers: number;
}

export interface WorkflowBreakdown {
  leaveByStatus: Record<string, number>;
  feedbackByStatus: Record<string, number>;
}

/**
 * The north star: weekly active verified members, and the ratio the metric tree targets at ≥ 55%.
 *
 * Only computable since S9-15 — `product_event` is the first thing in the product that records
 * *when* somebody was active, and no operational table could have answered it, because a live row
 * knows its present state and has forgotten how it got there.
 */
export interface ActivityBreakdown {
  /** Distinct verified members with at least one active day in the last seven. */
  weeklyActiveMembers: number;
  /** Against verified members. `null` when the school has none — a ratio over zero is not 0%. */
  weeklyActiveRate: number | null;
  /**
   * How far back the history goes. A school onboarded on Tuesday has no seven-day number yet, and
   * a figure that silently means "since Tuesday" is worse than one that says so.
   */
  since: string;
}

export interface SchoolAnalyticsResponse {
  window: AnalyticsWindow;
  activity: ActivityBreakdown;
  membership: MembershipBreakdown;
  structure: StructureBreakdown;
  publishing: PublishingBreakdown;
  engagement: EngagementBreakdown;
  workflows: WorkflowBreakdown;
}
