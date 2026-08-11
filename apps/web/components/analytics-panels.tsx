/**
 * The figures on the analytics page (S6-8).
 *
 * Server-rendered: nothing here is interactive, and a chart library would be several hundred
 * kilobytes to draw numbers a table states more precisely. The bars are `aria-hidden` for the same
 * reason they are on the billing page — "Students, 24" already carries everything the bar conveys.
 */
import { Card } from '@connected/ui';
import type { MessageKey, Translator } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { SchoolAnalyticsResponse } from '@connected/types';

const ROLE_LABELS: Record<string, MessageKey> = {
  STUDENT: 'analytics.roleSTUDENT',
  PARENT: 'analytics.rolePARENT',
  TEACHER: 'analytics.roleTEACHER',
  PRINCIPAL: 'analytics.rolePRINCIPAL',
  USER: 'analytics.roleUSER',
};

const ITEM_LABELS: Record<string, MessageKey> = {
  HOMEWORK: 'analytics.itemHOMEWORK',
  ASSIGNMENT: 'analytics.itemASSIGNMENT',
  PROJECT: 'analytics.itemPROJECT',
};

const STATUS_LABELS: Record<string, MessageKey> = {
  RECEIVED: 'analytics.statusRECEIVED',
  APPROVED: 'analytics.statusAPPROVED',
  REJECTED: 'analytics.statusREJECTED',
  CANCELLED: 'analytics.statusCANCELLED',
  OPEN: 'analytics.statusOPEN',
  IN_REVIEW: 'analytics.statusIN_REVIEW',
  RESOLVED: 'analytics.statusRESOLVED',
  DISMISSED: 'analytics.statusDISMISSED',
};

function label(map: Record<string, MessageKey>, key: string, t: Translator): string {
  // An unmapped key prints as itself rather than vanishing: a new enum value should look odd on
  // the page, not be silently absent from a total.
  return key in map ? t(map[key] as MessageKey) : key;
}

function Figures({ title, entries }: { title: string; entries: [string, number][] }) {
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <Card as="section">
      <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{title}</h2>

      {entries.length === 0 ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Nothing in this period.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
          {entries.map(([key, count]) => (
            <li key={key}>
              <p style={{ margin: '0 0 0.25rem' }}>
                {key}, {count}
              </p>
              <div
                aria-hidden="true"
                style={{
                  height: '0.375rem',
                  borderRadius: 'var(--ui-radius)',
                  background: 'var(--ui-color-surface-2, #e5e7eb)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${String(total === 0 ? 0 : Math.round((count / total) * 100))}%`,
                    height: '100%',
                    background: 'var(--ui-color-accent, #2563eb)',
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function percent(rate: number | null, t: Translator): string {
  // `null` is "nothing was published", which is not 0% — the API is careful about this and the
  // page would throw the distinction away by formatting it as a number.
  return rate === null ? t('analytics.nothingPublished') : `${String(Math.round(rate * 100))}%`;
}

export async function AnalyticsPanels({ analytics }: { analytics: SchoolAnalyticsResponse }) {
  const { t } = await getTranslations();

  const toEntries = (
    record: Record<string, number>,
    labels: Record<string, MessageKey>,
    translate: Translator,
  ) =>
    Object.entries(record)
      .map(([key, count]): [string, number] => [label(labels, key, translate), count])
      .sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-5)' }}>
      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>{t('analytics.yourSchool')}</h2>
        <p style={{ marginBottom: 0 }}>
          {/* One sentence with three counted nouns in it. Assembled from three whole phrases
              rather than six fragments, because the order of "members / classes / subjects" is
              not the same in every language and a fragment cannot be moved. */}
          {t('analytics.summary', {
            members:
              analytics.membership.total === 1
                ? t('analytics.memberOne')
                : t('analytics.memberMany', { count: analytics.membership.total }),
            classes:
              analytics.structure.classes === 1
                ? t('analytics.classOne')
                : t('analytics.classMany', { count: analytics.structure.classes }),
            subjects:
              analytics.structure.subjects === 1
                ? t('analytics.subjectOne')
                : t('analytics.subjectMany', { count: analytics.structure.subjects }),
          })}
        </p>
      </Card>

      <Figures
        title={t('analytics.members')}
        entries={toEntries(analytics.membership.byRole, ROLE_LABELS, t)}
      />

      <Figures
        title={t('analytics.publishedTitle')}
        entries={(
          [
            ...toEntries(analytics.publishing.academicItems, ITEM_LABELS, t),
            [t('analytics.notices'), analytics.publishing.notices],
            [t('analytics.events'), analytics.publishing.events],
          ] as [string, number][]
        ).filter(([, count]) => count > 0)}
      />

      <Card as="section">
        <h2 style={{ marginTop: 0, fontSize: 'var(--ui-text-lg)' }}>
          {t('analytics.readThrough')}
        </h2>
        <p style={{ margin: '0 0 0.5rem' }}>
          {t('analytics.noticesRead', { percent: percent(analytics.engagement.noticeReadRate, t) })}
        </p>
        <p style={{ margin: '0 0 0.5rem' }}>
          {t('analytics.academicsRead', {
            percent: percent(analytics.engagement.academicReadRate, t),
          })}
        </p>
        <p className="muted" style={{ marginBottom: 0 }}>
          {/* The denominator, stated. A rate whose base is invisible cannot be argued with. */}
          {t('analytics.denominator', { count: analytics.engagement.verifiedMembers })}
        </p>
      </Card>

      <Figures
        title={t('analytics.leave')}
        entries={toEntries(analytics.workflows.leaveByStatus, STATUS_LABELS, t)}
      />

      <Figures
        title={t('analytics.feedback')}
        entries={toEntries(analytics.workflows.feedbackByStatus, STATUS_LABELS, t)}
      />
    </div>
  );
}
