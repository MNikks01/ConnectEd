/**
 * Classes (FR-INST-002, 006). List, create, and deactivate.
 */
import { Card, PageHeader } from '@connected/ui';
import { redirect } from 'next/navigation';

import { ClassCreateForm } from '@/components/class-create-form';
import { ClassTable } from '@/components/class-table';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';
import { getTranslations } from '@/lib/i18n/server';

import type { ClassResponse, CurrentAccountResponse } from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('schoolClasses.metaTitle') };
}
export const dynamic = 'force-dynamic';

export default async function ClassesPage() {
  const { t } = await getTranslations();

  let account: CurrentAccountResponse;
  let classes: ClassResponse[];

  try {
    account = await readAsUser<CurrentAccountResponse>('/me');
    // includeInactive so the school can see and reactivate what it has switched off.
    const response = await readAsUser<{ data: ClassResponse[] }>(
      `/schools/${account.id}/classes?includeInactive=true`,
    );
    classes = response.data;
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect('/api/auth/refresh?next=/school/classes');
    throw error;
  }

  return (
    <>
      <PageHeader title={t('schoolClasses.title')} description={t('schoolClasses.description')} />

      {/* `minmax(0, 1fr)`, not the default `auto`. A grid item's automatic minimum size is
          content-based, so the class table's min-content width — which is wider than 320px once
          the fonts are CI's rather than macOS's — made this column 321px inside a 288px page and
          scrolled the whole document sideways. The track has to be told it may shrink; the
          `overflow-x` on the table's own scroll container cannot do it from the inside. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: 'var(--ui-space-5)',
        }}
      >
        <ClassTable classes={classes} />

        <Card as="section">
          <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
            {t('schoolClasses.addHeading')}
          </h2>
          <ClassCreateForm schoolId={account.id} />
        </Card>
      </div>
    </>
  );
}
