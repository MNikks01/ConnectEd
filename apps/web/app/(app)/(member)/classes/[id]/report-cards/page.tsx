/**
 * A class's report cards (FR-GRADE-040 … 043).
 *
 * One route, three audiences, and — as with marks and the register — it asks a **different
 * endpoint** for each rather than fetching the class and hiding the rest. A pupil and their parent
 * must never receive the whole class's cards and have them filtered by a component.
 *
 * The one thing this screen must never do is compute. Every number shown comes out of the stored
 * snapshot: the card is a document, and a document that recalculates itself when you open it is not
 * one. See `components/report-card.tsx`.
 */
import { Card, PageHeader } from '@connected/ui';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ReportCardIssuer } from '@/components/report-card-issuer';
import { ReportCardView } from '@/components/report-card';
import { ApiError } from '@/lib/api-client';
import { getTranslations } from '@/lib/i18n/server';
import { readAsUser, SessionExpiredError } from '@/lib/server-api';

import type {
  MyClassTeacherResponse,
  MyMembershipResponse,
  ReportCardResponse,
  TermResponse,
} from '@connected/types';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('reportCardsPage.metaTitle') };
}

export const dynamic = 'force-dynamic';

function CardList({ cards, empty }: { cards: ReportCardResponse[]; empty: string }) {
  if (cards.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{empty}</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {cards.map((card) => (
        <ReportCardView key={card.id} card={card} />
      ))}
    </div>
  );
}

export default async function ReportCardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ termId?: string }>;
}) {
  const { id } = await params;
  const { t } = await getTranslations();
  const { termId } = await searchParams;
  const back = `/classes/${id}/report-cards`;

  let memberships: MyMembershipResponse[] = [];
  let classTeacherOf: MyClassTeacherResponse[] = [];

  try {
    [memberships, classTeacherOf] = await Promise.all([
      readAsUser<{ data: MyMembershipResponse[] }>('/me/memberships').then((r) => r.data),
      readAsUser<{ data: MyClassTeacherResponse[] }>('/me/class-teacher').then((r) => r.data),
    ]);
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=${back}`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const forThisClass = memberships.filter((membership) => membership.classId === id);
  const asPupil = forThisClass.find((membership) => membership.role === 'STUDENT');
  const asParent = forThisClass.filter((membership) => membership.role === 'PARENT');
  const issuing = classTeacherOf.find((allocation) => allocation.classId === id);
  const schoolId = issuing?.schoolId ?? memberships[0]?.schoolId;

  let terms: TermResponse[] = [];
  let classCards: ReportCardResponse[] = [];
  let selectedTerm = termId ?? '';
  let mine: ReportCardResponse[] = [];
  const childrens: { name: string; cards: ReportCardResponse[]; unlinked: boolean }[] = [];

  try {
    // Staff reads are attempted and allowed to be refused. A subject teacher is deliberately
    // refused a card (unlike a mark), and that refusal must leave the rest of their page working
    // rather than turning into a 404 for everyone.
    if (schoolId) {
      try {
        terms = (await readAsUser<{ data: TermResponse[] }>(`/schools/${schoolId}/terms`)).data;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }

    // Newest first from the API, so the current term is the sensible default to land on.
    if (selectedTerm === '' && terms.length > 0) selectedTerm = terms[0]?.id ?? '';

    if (selectedTerm !== '') {
      try {
        classCards = (
          await readAsUser<{ data: ReportCardResponse[] }>(
            `/classes/${id}/report-cards?termId=${selectedTerm}`,
          )
        ).data;
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
      }
    }

    if (asPupil) {
      // Every card this pupil holds, narrowed to the class being looked at — their own data
      // either way, so the narrowing is for sense, not for safety.
      mine = (await readAsUser<{ data: ReportCardResponse[] }>('/me/report-cards')).data.filter(
        (card) => card.classId === id,
      );
    }

    for (const membership of asParent) {
      if (!membership.childId) continue;

      try {
        const cards = (
          await readAsUser<{ data: ReportCardResponse[] }>(
            `/children/${membership.childId}/report-cards`,
          )
        ).data.filter((card) => card.classId === id);
        childrens.push({
          name: membership.childName ?? t('reportCardsPage.yourChild'),
          cards,
          unlinked: false,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          childrens.push({
            name: membership.childName ?? t('reportCardsPage.yourChild'),
            cards: [],
            unlinked: true,
          });
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof SessionExpiredError) redirect(`/api/auth/refresh?next=${back}`);
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) notFound();
    throw error;
  }

  const staffView = classCards.length > 0 || Boolean(issuing);

  return (
    <main>
      <p style={{ marginTop: 0 }}>
        <Link href={`/classes/${id}`}>{t('reportCardsPage.backToClass')}</Link>
      </p>

      <PageHeader
        title={t('reportCardsPage.title')}
        description={t('reportCardsPage.description')}
      />

      {issuing ? (
        <section style={{ marginBottom: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>{t('reportCardsPage.issue')}</h2>
          <ReportCardIssuer
            classId={id}
            terms={terms}
            selectedTermId={selectedTerm}
            cards={classCards}
          />
        </section>
      ) : null}

      {staffView ? (
        <section style={{ marginBottom: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>{t('reportCardsPage.thisClass')}</h2>

          {terms.length > 1 ? (
            // A plain GET form: choosing a term is navigation, not a mutation, so it belongs in
            // the URL where it can be linked to and reloaded.
            <form method="get" style={{ marginBottom: 'var(--ui-space-4)' }}>
              <label htmlFor="term-picker">{t('reportCardsPage.termShown')}</label>{' '}
              <select id="term-picker" name="termId" defaultValue={selectedTerm}>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>{' '}
              <button type="submit">{t('reportCardsPage.show')}</button>
            </form>
          ) : null}

          <CardList cards={classCards} empty={t('reportCardsPage.noneForTerm')} />
        </section>
      ) : null}

      {asPupil ? (
        <section style={{ marginBottom: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>{t('reportCardsPage.yours')}</h2>
          <CardList cards={mine} empty={t('reportCardsPage.noneYours')} />
        </section>
      ) : null}

      {childrens.map((child) => (
        <section key={child.name} style={{ marginBottom: 'var(--ui-space-5)' }}>
          <h2 style={{ fontSize: 'var(--ui-font-size-3)' }}>{child.name}</h2>
          {child.unlinked ? (
            <Card>
              <p style={{ margin: 0 }}>
                Your school has not yet linked {child.name} to their student account, so their
                report cards cannot be shown here. Ask the school to link them.
              </p>
            </Card>
          ) : (
            <CardList
              cards={child.cards}
              empty={`Your school has not issued a report card for ${child.name} in this class yet.`}
            />
          )}
        </section>
      ))}

      {!staffView && !asPupil && childrens.length === 0 ? (
        <Card>
          <p style={{ margin: 0 }}>{t('reportCardsPage.nothingToSee')}</p>
        </Card>
      ) : null}
    </main>
  );
}
