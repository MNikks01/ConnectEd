/**
 * A structured week, rendered (FR-ACAD-021).
 *
 * **A table per day, not one grid of boxes.** The obvious rendering is days across the top and
 * times down the side, which looks like the sheet on the wall — and is close to unusable on a phone
 * and actively hostile to a screen reader, because a lesson's meaning comes from a column header
 * several rows up. This lists each day in order with its periods under it: one relationship per
 * row, readable in a single column, and it is what a parent checking tomorrow morning wants.
 *
 * Days with nothing in them are left out rather than shown empty. A school that teaches six days
 * should not have a Sunday heading, and one that does teach Sunday gets one.
 *
 * **A Server Component with plain markup, deliberately.** `@connected/ui`'s `Table` would be the
 * obvious reach, and it cannot be used here: it is a client component and its columns are `render`
 * functions, which do not cross the server boundary — the page 500s. Since a timetable has no
 * interactivity at all, the answer is not to make this a client component and ship the JavaScript,
 * but to write the same markup the design system writes and reuse its classes. The conventions
 * that matter are kept: a real `<table>`, `<th scope>`, and a caption that names it for anyone who
 * arrives at it without the heading above.
 */
import { Card } from '@connected/ui';
import type { MessageKey } from '@/lib/i18n/translate';
import { getTranslations } from '@/lib/i18n/server';

import type { TimetablePeriodResponse, Weekday } from '@connected/types';

const DAY_NAMES: Record<Weekday, MessageKey> = {
  MONDAY: 'timetableGrid.MONDAY',
  TUESDAY: 'timetableGrid.TUESDAY',
  WEDNESDAY: 'timetableGrid.WEDNESDAY',
  THURSDAY: 'timetableGrid.THURSDAY',
  FRIDAY: 'timetableGrid.FRIDAY',
  SATURDAY: 'timetableGrid.SATURDAY',
  SUNDAY: 'timetableGrid.SUNDAY',
};

/** The order a week is read in, which is not the order rows arrive in. */
const WEEK = Object.keys(DAY_NAMES) as Weekday[];

export async function TimetableGrid({ periods }: { periods: TimetablePeriodResponse[] }) {
  const { t } = await getTranslations();

  const byDay = WEEK.map((day) => ({
    day,
    periods: periods.filter((period) => period.day === day),
  })).filter((entry) => entry.periods.length > 0);

  if (byDay.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>{t('timetableGrid.empty')}</p>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      {byDay.map((entry) => (
        <section key={entry.day}>
          <h2 style={{ fontSize: 'var(--ui-text-lg)', margin: '0 0 var(--ui-space-2)' }}>
            {t(DAY_NAMES[entry.day])}
          </h2>

          <div className="ui-table__scroll">
            <table className="ui-table">
              <caption className="ui-visually-hidden">
                {t('timetableGrid.dayTimetable', { day: t(DAY_NAMES[entry.day]) })}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('timetableGrid.colTime')}</th>
                  <th scope="col">{t('timetableGrid.colSubject')}</th>
                </tr>
              </thead>
              <tbody>
                {entry.periods.map((period) => (
                  <tr key={period.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {period.startsAt}–{period.endsAt}
                    </td>
                    {/* A break is not a lesson, and saying so plainly beats an empty cell. */}
                    <td>{period.subjectName ?? period.label ?? t('timetableGrid.unnamed')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
