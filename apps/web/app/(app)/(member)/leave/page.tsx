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
  return { title: t('leavePage.metaTitle') };
}

export const dynamic = 'force-dynamic';

export default async function LeavePage() {
  const { t } = await getTranslations();

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
        .map((membership) => [
          membership.schoolId,
          membership.schoolName ?? t('leavePage.yourSchool'),
        ]),
    ).entries(),
  ].map(([id, name]) => ({ id, name }));

  const principalAt = memberships.filter((membership) => membership.role === 'PRINCIPAL');
  const decides = classTeacherOf.length > 0 || principalAt.length > 0;

  return (
    <main>
      <PageHeader
        title={t('leavePage.title')}
        description={t('leavePage.description')}
        {...(decides
          ? { actions: <Link href="/leave/approvals">{t('leavePage.toDecide')}</Link> }
          : {})}
      />

      {children.length === 0 && teacherAt.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('leavePage.notEligible')}</p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          {children.length > 0 ? (
            <Card as="section">
              <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
                {t('leavePage.applyForChild')}
              </h2>
              <ApplyForChildForm children={children} />
            </Card>
          ) : null}

          {teacherAt.length > 0 ? (
            <Card as="section">
              <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
                {t('leavePage.applyForSelf')}
              </h2>
              <ApplyForSelfForm schools={teacherAt} />
            </Card>
          ) : null}
        </div>
      )}

      <section style={{ marginTop: 'var(--ui-space-5)' }}>
        <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('leavePage.yourApplications')}</h2>
        <LeaveHistory applications={mine} />
      </section>
    </main>
  );
}
