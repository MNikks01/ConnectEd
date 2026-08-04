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

export interface SchoolAnalyticsResponse {
  window: AnalyticsWindow;
  membership: MembershipBreakdown;
  structure: StructureBreakdown;
  publishing: PublishingBreakdown;
  engagement: EngagementBreakdown;
  workflows: WorkflowBreakdown;
}
