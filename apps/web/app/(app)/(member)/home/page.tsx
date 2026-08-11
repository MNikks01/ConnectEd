/**
 * The member home. A Server Component: it calls the API during SSR using the access token from the
 * httpOnly cookie, so the token never reaches the browser.
 *
 * The classes list is the product's front door — until it existed, a verified student had no way
 * to reach their own class feed at all.
 */
import { Badge, Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  DueSoon,
  RecentNotices,
  TeachingSubjects,
  UnreadWork,
} from '@/components/dashboard-sections';
import { dueSoon, loadDashboard, MAX_CLASSES, unread } from '@/lib/dashboard';

import type { DashboardData } from '@/lib/dashboard';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  CurrentAccountResponse,
  MyMembershipResponse,
  MyTeachingSubjectResponse,
} from '@connected/types';
import type { Metadata } from 'next';
import type { Translator } from '@/lib/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('home.metaTitle') };
}

// Personalized and session-dependent — never prerendered or cached.
export const dynamic = 'force-dynamic';

/**
 * How a membership reads in a sentence, since the role alone is ambiguous for a parent.
 *
 * The roles are looked up rather than title-cased from the enum. `role.charAt(0) + …toLowerCase()`
 * produced "Student" in English and would produce "STUDENT" in every other language, because
 * capitalisation is not a translation and most scripts do not have a case to change.
 */
function membershipLabel(membership: MyMembershipResponse, t: Translator): string {
  if (membership.role === 'PARENT') {
    return membership.childName
      ? t('home.parentOf', { name: membership.childName })
      : t('home.parent');
  }

  switch (membership.role) {
    case 'STUDENT':
      return t('home.student');
    case 'TEACHER':
      return t('home.teacher');
    case 'PRINCIPAL':
      return t('home.principal');
    default:
      return t('home.user');
  }
}

export default async function AppHomePage() {
  const { t } = await getTranslations();

  let account: CurrentAccountResponse;
  let memberships: MyMembershipResponse[] = [];
  let teaching: MyTeachingSubjectResponse[] = [];
  let dashboard: DashboardData = { items: [], notices: [], truncated: false };

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;

    // A school's dashboard is the portal; there is nothing to assemble here for one.
    if (account.accountType !== 'SCHOOL') {
      [teaching, dashboard] = await Promise.all([
        readAsUser<{ data: MyTeachingSubjectResponse[] }>('/me/subjects').then(
          (response) => response.data,
        ),
        loadDashboard(memberships),
      ]);
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/home');
    throw error;
  }

  // A school has no memberships of its own; it reaches its classes through the portal.
  const isSchool = account.accountType === 'SCHOOL';
  const classes = memberships.filter((membership) => membership.classId !== null);

  // Roles are not exclusive: one person can be a parent at one school and a teacher at another,
  // so the dashboard composes sections rather than choosing one of four layouts.
  const teaches = teaching.length > 0 || memberships.some((m) => m.role === 'TEACHER');
  const learns = memberships.some((m) => m.role === 'STUDENT' || m.role === 'PARENT');

  const deadlines = dueSoon(dashboard.items);
  const unreadItems = unread(dashboard.items);

  return (
    <main>
      <PageHeader
        title={t('home.greeting', {
          name: account.fullName ?? account.schoolName ?? account.email,
        })}
        description={
          isSchool
            ? t('home.schoolDescription')
            : classes.length > 0
              ? t('home.memberDescription')
              : t('home.unverifiedDescription')
        }
      />

      {isSchool ? null : (
        <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
          {teaches ? <TeachingSubjects subjects={teaching} /> : null}
          {learns ? <DueSoon items={deadlines} /> : null}
          <UnreadWork items={unreadItems} />
          <RecentNotices notices={dashboard.notices} />
        </div>
      )}

      {isSchool ? (
        <Card>
          <p style={{ margin: 0 }}>
            {t('home.schoolPortalNote')} <Link href="/school">{t('home.schoolPortalLink')}</Link>.
          </p>
        </Card>
      ) : (
        <section>
          <h2 style={{ fontSize: 'var(--ui-text-lg)' }}>{t('home.yourClasses')}</h2>

          {classes.length === 0 ? (
            <Card>
              <p style={{ margin: 0 }}>{t('home.noClasses')}</p>
            </Card>
          ) : (
            <ul
              style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}
            >
              {classes.map((membership) => (
                <li key={`${membership.classId}-${membership.childId ?? membership.role}`}>
                  <Card>
                    <h3 style={{ margin: 0, fontSize: 'var(--ui-text-base)' }}>
                      <Link href={`/classes/${membership.classId}`}>
                        {membership.className ?? t('home.classFallback')}
                      </Link>
                    </h3>

                    <p className="muted" style={{ margin: '0.25rem 0 0.5rem' }}>
                      {membership.schoolName ?? t('home.schoolFallback')}
                    </p>

                    <Badge tone="info">{membershipLabel(membership, t)}</Badge>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {dashboard.truncated ? (
            <p className="muted" style={{ fontSize: 'var(--ui-text-sm)' }}>
              {t('home.truncated', { count: MAX_CLASSES })}
            </p>
          ) : null}
        </section>
      )}

      <div style={{ marginTop: 'var(--ui-space-5)' }}>
        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{t('home.yourAccount')}</h2>

          <dl className="summary">
            <dt>{t('home.name')}</dt>
            <dd>{account.fullName ?? account.schoolName ?? '—'}</dd>

            <dt>{t('home.accountType')}</dt>
            <dd>{account.accountType}</dd>

            <dt>{t('home.email')}</dt>
            <dd>{account.email}</dd>

            <dt>{t('home.role')}</dt>
            <dd>{account.role ?? t('home.notApplicable')}</dd>

            <dt>{t('home.handle')}</dt>
            <dd>{account.handle ?? '—'}</dd>

            <dt>{t('home.emailVerifiedLabel')}</dt>
            <dd>
              <Badge tone={account.emailVerified ? 'success' : 'warning'}>
                {account.emailVerified ? t('home.verified') : t('home.notVerified')}
              </Badge>
            </dd>
          </dl>
        </Card>
      </div>
    </main>
  );
}
