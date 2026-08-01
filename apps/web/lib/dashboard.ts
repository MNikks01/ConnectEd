/**
 * Dashboard data assembly (S2-11).
 *
 * The API is scoped per class, per school — deliberately, because that is where authorization
 * lives. A dashboard is the one view that crosses those scopes, so the crossing happens *here*,
 * in the BFF, by making several authorized requests rather than by adding an endpoint that would
 * have to re-derive every policy it aggregates over.
 *
 * The fan-out is bounded: at most `MAX_CLASSES` classes and `MAX_SCHOOLS` schools, which covers a
 * parent with several children and a teacher across two schools. Beyond that the dashboard shows
 * a subset — stated on the page rather than silently truncated.
 */
import { readAsUser } from './server-api';

import type { DashboardItem } from '@/components/dashboard-sections';
import type { MyMembershipResponse, NoticeResponse, Paginated } from '@connected/types';
import type { AcademicItemResponse } from '@connected/types';

export const MAX_CLASSES = 6;
export const MAX_SCHOOLS = 3;
/** Far enough ahead to plan a week, near enough that "due soon" still means something. */
const DUE_WITHIN_DAYS = 7;
const MAX_UNREAD = 5;
const MAX_NOTICES = 3;

export interface DashboardData {
  items: DashboardItem[];
  notices: NoticeResponse[];
  /** True when the member is in more classes than the dashboard reads. */
  truncated: boolean;
}

/** One class's recent items, tagged with the class name the dashboard shows. */
async function itemsForClass(membership: MyMembershipResponse): Promise<DashboardItem[]> {
  if (!membership.classId) return [];

  const feed = await readAsUser<Paginated<AcademicItemResponse>>(
    `/classes/${membership.classId}/academics?limit=20`,
  );

  return feed.data.map((item) => ({ ...item, className: membership.className ?? 'Class' }));
}

export async function loadDashboard(memberships: MyMembershipResponse[]): Promise<DashboardData> {
  const classes = memberships.filter((membership) => membership.classId !== null);
  const schools = [...new Set(memberships.map((membership) => membership.schoolId))];

  const [itemLists, noticeLists] = await Promise.all([
    // Concurrent, not sequential: six round trips one after another is six times the latency for
    // data that has no ordering dependency.
    Promise.all(classes.slice(0, MAX_CLASSES).map(itemsForClass)),
    Promise.all(
      schools
        .slice(0, MAX_SCHOOLS)
        .map((schoolId) =>
          readAsUser<Paginated<NoticeResponse>>(
            `/schools/${schoolId}/notices?limit=${MAX_NOTICES}`,
          ),
        ),
    ),
  ]);

  return {
    items: itemLists.flat(),
    notices: noticeLists.flatMap((list) => list.data).slice(0, MAX_NOTICES),
    truncated: classes.length > MAX_CLASSES,
  };
}

/** Items with a deadline inside the window, soonest first. */
export function dueSoon(items: DashboardItem[]): DashboardItem[] {
  const horizon = Date.now() + DUE_WITHIN_DAYS * 24 * 3600_000;

  return items
    .filter((item) => {
      if (!item.dueAt) return false;

      const due = new Date(item.dueAt).getTime();
      // Overdue work stays on the list: it is more urgent than what is merely upcoming, not less.
      return due <= horizon;
    })
    .sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime());
}

export function unread(items: DashboardItem[]): DashboardItem[] {
  return items.filter((item) => !item.read).slice(0, MAX_UNREAD);
}
