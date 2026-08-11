/**
 * The register for a class on a day (FR-ATT-001, 030, 031).
 *
 * One route, three audiences again — and, as with marks, it asks a *different endpoint* for each
 * rather than fetching the register and filtering it. A pupil and their parent must never receive
 * the whole class's attendance and have it hidden by a component.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { RegisterForm } from '@/components/register-form';
import { ApiError } from '@/lib/api-client';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  MyAttendanceResponse,
  MyMembershipResponse,
  RegisterResponse,
} from '@connected/types';
import type { Metadata } from 'next';
import type { MessageKey, Translator } from '@/lib/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('attendanceRegister.metaTitle') };
}

export const dynamic = 'force-dynamic';

/** Plain words rather than a colour or an icon alone. */
const STATE_LABEL: Record<string, MessageKey> = {
  PRESENT: 'attendanceRegister.present',
  ABSENT: 'attendanceRegister.absent',
  LATE: 'attendanceRegister.late',
  EXCUSED: 'attendanceRegister.excused',
};

function DayList({ days, t }: { days: MyAttendanceResponse[]; t: Translator }) {
  if (days.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{t('attendanceRegister.none')}</p>
      </Card>
    );
  }

  return (
    <Card>
      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
        {days.map((day) => (
          <li key={day.onDate}>
            {day.onDate} —{' '}
            {day.state in STATE_LABEL ? t(STATE_LABEL[day.state] as MessageKey) : day.state}
            {day.fromLeave ? t('attendanceRegister.fromLeave') : ''}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;
  const onDate = date ?? new Date().toISOString().slice(0, 10);
  const { t } = await getTranslations();

  let memberships: MyMembershipResponse[] = [];

  try {
    memberships = (await readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships')).data;
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/classes/${id}/register`);
    }
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const forThisClass = memberships.filter((membership) => membership.classId === id);
  const asPupil = forThisClass.find((membership) => membership.role === 'STUDENT');
  const asParent = forThisClass.filter((membership) => membership.role === 'PARENT');
  const staff = memberships.some(
    (membership) => membership.role === 'TEACHER' || membership.role === 'PRINCIPAL',
  );

  let register: RegisterResponse | undefined;
  let mine: MyAttendanceResponse[] = [];
  const childrens: { name: string; days: MyAttendanceResponse[]; unlinked: boolean }[] = [];

  try {
    if (staff) {
      register = await readAsUser<RegisterResponse>(`/classes/${id}/register?date=${onDate}`);
    }

    if (asPupil) {
      mine = (await readAsUser<{ data: MyAttendanceResponse[] }>(`/me/classes/${id}/attendance`))
        .data;
    }

    for (const membership of asParent) {
      if (!membership.childId) continue;

      try {
        const days = (
          await readAsUser<{ data: MyAttendanceResponse[] }>(
            `/children/${membership.childId}/attendance`,
          )
        ).data;
        childrens.push({
          name: membership.childName ?? t('attendanceRegister.yourChild'),
          days,
          unlinked: false,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          childrens.push({
            name: membership.childName ?? t('attendanceRegister.yourChild'),
            days: [],
            unlinked: true,
          });
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) {
      redirect(`/api/auth/refresh?next=/classes/${id}/register`);
    }
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${id}`}>{t('attendanceRegister.backToClass')}</Link>
      </p>

      <PageHeader
        title={t('attendanceRegister.title')}
        description={t('attendanceRegister.description', { date: onDate })}
      />

      {register ? <RegisterForm register={register} /> : null}

      {asPupil ? (
        <section style={{ marginTop: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>
            {t('attendanceRegister.yourAttendance')}
          </h2>
          <DayList days={mine} t={t} />
        </section>
      ) : null}

      {childrens.map((child) => (
        <section key={child.name} style={{ marginTop: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>{child.name}</h2>
          {child.unlinked ? (
            <Card>
              <p style={{ margin: 0 }}>{t('attendanceRegister.unlinked', { name: child.name })}</p>
            </Card>
          ) : (
            <DayList days={child.days} t={t} />
          )}
        </section>
      ))}

      {!register && !asPupil && childrens.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('attendanceRegister.nothingToSee')}</p>
        </Card>
      ) : null}
    </main>
  );
}
