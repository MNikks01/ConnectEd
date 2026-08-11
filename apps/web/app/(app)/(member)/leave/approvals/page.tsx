/**
 * The queues the caller may decide (FR-WF-003, 004).
 *
 * Which queues those are is a question only the API can answer: a class teacher's allocation lives
 * on the class, and a principal's authority on their membership. The page asks, then reads exactly
 * the queues it was told about — it never guesses at a class id.
 */
import { PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LeaveQueue } from '@/components/leave-queue';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  LeaveApplicationResponse,
  MyClassTeacherResponse,
  MyMembershipResponse,
} from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('approvals.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function LeaveApprovalsPage() {
  const { t } = await getTranslations();

  let classes: MyClassTeacherResponse[];
  let principalSchools: { id: string; name: string }[];

  try {
    const [allocations, memberships] = await Promise.all([
      readAsUser<{ data: MyClassTeacherResponse[] }>('/me/class-teacher').then((r) => r.data),
      readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships').then((r) => r.data),
    ]);

    classes = allocations;
    principalSchools = [
      ...new Map(
        memberships
          .filter((membership) => membership.role === 'PRINCIPAL')
          .map((m) => [m.schoolId, m.schoolName ?? t('approvals.yourSchool')]),
      ).entries(),
    ].map(([id, name]) => ({ id, name }));
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/leave/approvals');
    throw error;
  }

  const classQueues = await Promise.all(
    classes.map(async (allocation) => ({
      allocation,
      applications: (
        await readAsUser<{ data: LeaveApplicationResponse[] }>(
          `/classes/${allocation.classId}/leave?status=RECEIVED`,
        )
      ).data,
    })),
  );

  const teacherQueues = await Promise.all(
    principalSchools.map(async (school) => ({
      school,
      applications: (
        await readAsUser<{ data: LeaveApplicationResponse[] }>(
          `/schools/${school.id}/leave/teacher?status=RECEIVED`,
        )
      ).data,
    })),
  );

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href="/leave">{t('approvals.back')}</Link>
      </p>

      <PageHeader title={t('approvals.title')} />

      {classQueues.length === 0 && teacherQueues.length === 0 ? (
        <p>{t('approvals.notAnApprover')}</p>
      ) : null}

      <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
        {classQueues.map(({ allocation, applications }) => (
          <section key={allocation.classId}>
            <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{allocation.className}</h2>
            <LeaveQueue applications={applications} emptyMessage={t('approvals.noClassLeave')} />
          </section>
        ))}

        {teacherQueues.map(({ school, applications }) => (
          <section key={school.id}>
            <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>
              {t('approvals.teacherLeaveHeading', { school: school.name })}
            </h2>
            <LeaveQueue applications={applications} emptyMessage={t('approvals.noTeacherLeave')} />
          </section>
        ))}
      </div>
    </main>
  );
}
