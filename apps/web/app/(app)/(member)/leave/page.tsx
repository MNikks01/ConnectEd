/**
 * Applying for leave, and following what you applied for (FR-WF-001, 002, 005).
 *
 * One page for both kinds of applicant. A parent sees the child form, a teacher sees the own-leave
 * form, and someone who is both — a teacher with a child at the school — sees both, because the
 * memberships say so.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ApplyForChildForm, ApplyForSelfForm } from '@/components/leave-forms';
import { LeaveHistory } from '@/components/leave-queue';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  LeaveApplicationResponse,
  MyClassTeacherResponse,
  MyMembershipResponse,
} from '@connected/types';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Leave · GetConnected' };

export const dynamic = 'force-dynamic';

export default async function LeavePage() {
  let memberships: MyMembershipResponse[];
  let mine: LeaveApplicationResponse[];
  let classTeacherOf: MyClassTeacherResponse[];

  try {
    [memberships, mine, classTeacherOf] = await Promise.all([
      readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships').then((r) => r.data),
      readAsUser<{ data: LeaveApplicationResponse[] }>('/me/leave').then((r) => r.data),
      readAsUser<{ data: MyClassTeacherResponse[] }>('/me/class-teacher').then((r) => r.data),
    ]);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/leave');
    throw error;
  }

  const children = memberships.filter(
    (membership) => membership.role === 'PARENT' && membership.childId !== null,
  );
  const teacherAt = [
    ...new Map(
      memberships
        .filter((membership) => membership.role === 'TEACHER')
        .map((membership) => [membership.schoolId, membership.schoolName ?? 'Your school']),
    ).entries(),
  ].map(([id, name]) => ({ id, name }));

  const principalAt = memberships.filter((membership) => membership.role === 'PRINCIPAL');
  const decides = classTeacherOf.length > 0 || principalAt.length > 0;

  return (
    <main>
      <PageHeader
        title="Leave"
        description="Apply, and see where your applications got to."
        {...(decides
          ? { actions: <Link href="/leave/approvals">Applications to decide</Link> }
          : {})}
      />

      {children.length === 0 && teacherAt.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>
            Leave is for parents applying on behalf of a child, and for teachers applying for
            themselves. Neither applies to you yet.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          {children.length > 0 ? (
            <Card as="section">
              <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Apply for your child</h2>
              <ApplyForChildForm children={children} />
            </Card>
          ) : null}

          {teacherAt.length > 0 ? (
            <Card as="section">
              <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>Apply for yourself</h2>
              <ApplyForSelfForm schools={teacherAt} />
            </Card>
          ) : null}
        </div>
      )}

      <section style={{ marginTop: 'var(--ui-space-5)' }}>
        <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>Your applications</h2>
        <LeaveHistory applications={mine} />
      </section>
    </main>
  );
}
