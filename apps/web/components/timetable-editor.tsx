'use client';

/**
 * Building a structured week, for the school portal (FR-ACAD-021).
 *
 * **The whole week is published at once, and that is the important design decision.** A timetable
 * edited period by period against the server is a timetable that is wrong in between — a parent
 * reading it mid-edit sees a Tuesday with a gap in it, or two lessons at once, and turns up to the
 * wrong room. So periods are collected here, in the browser, and one submission becomes one
 * version. Nothing is stored until the school says it is finished, and the version it replaces
 * stays readable until the moment it does.
 *
 * The draft is deliberately not clever. No drag and drop, no grid, no automatic filling of the next
 * slot: a school with an existing paper timetable is copying it in, and a plain list of rows they
 * can read back against the sheet in front of them is faster and easier to check than anything that
 * tries to be a calendar.
 *
 * Validation is the server's. The form refuses the obvious nonsense — no end before start, no
 * period without a name — because saying so immediately is kinder than a round trip; but overlaps
 * and unknown subjects are decided by the API, and the message it sends is shown as-is.
 */
import { Button, Card, Field } from '@connected/ui';
import { useState } from 'react';

import { publishTimetableAction } from '@/app/(app)/school/actions';
import { ActionForm } from './action-form';
import type { MessageKey, Translator } from '@/lib/i18n/translate';
import { useTranslations } from './locale-provider';

import type { SubjectResponse, TimetablePeriodInput, Weekday } from '@connected/types';

const DAYS: { value: Weekday; label: MessageKey }[] = [
  { value: 'MONDAY', label: 'timetableEditor.MONDAY' },
  { value: 'TUESDAY', label: 'timetableEditor.TUESDAY' },
  { value: 'WEDNESDAY', label: 'timetableEditor.WEDNESDAY' },
  { value: 'THURSDAY', label: 'timetableEditor.THURSDAY' },
  { value: 'FRIDAY', label: 'timetableEditor.FRIDAY' },
  { value: 'SATURDAY', label: 'timetableEditor.SATURDAY' },
  { value: 'SUNDAY', label: 'timetableEditor.SUNDAY' },
];

/** The value in the subject picker that means "this period is not a lesson". */
const OTHER = 'other';

/**
 * Not a component, so it takes the translator rather than calling the hook.
 *
 * It briefly did call it, which React caught immediately: a hook in a plain helper runs a
 * different number of times per render depending on how many periods are in the list, and error
 * #310 is what that looks like from the outside.
 */
function describe(
  period: TimetablePeriodInput,
  subjects: SubjectResponse[],
  t: Translator,
): string {
  const what =
    period.label ??
    subjects.find((subject) => subject.id === period.subjectId)?.name ??
    t('timetableEditor.unknownSubject');
  const dayKey = DAYS.find((entry) => entry.value === period.day)?.label;
  const day = dayKey ? t(dayKey) : period.day;

  return `${day}, ${period.startsAt}–${period.endsAt}: ${what}`;
}

export function TimetableEditor({
  classId,
  subjects,
}: {
  classId: string;
  subjects: SubjectResponse[];
}) {
  const { t } = useTranslations();

  const [draft, setDraft] = useState<TimetablePeriodInput[]>([]);
  const [day, setDay] = useState<Weekday>('MONDAY');
  const [startsAt, setStartsAt] = useState('09:00');
  const [endsAt, setEndsAt] = useState('09:45');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? OTHER);
  const [label, setLabel] = useState('');
  const [problem, setProblem] = useState<string | undefined>();

  function add(): void {
    if (endsAt <= startsAt) {
      setProblem('A period has to end after it starts.');
      return;
    }

    const isOther = subjectId === OTHER || subjects.length === 0;
    const trimmed = label.trim();

    if (isOther && trimmed.length === 0) {
      setProblem(t('timetableEditor.nameRequired'));
      return;
    }

    setProblem(undefined);
    setDraft((current) => [
      ...current,
      {
        day,
        startsAt,
        endsAt,
        ...(isOther ? { label: trimmed } : { subjectId }),
      },
    ]);
    setLabel('');
    // The next period usually starts where the last one ended, which is the one bit of guessing
    // that saves real typing when copying a sheet in.
    setStartsAt(endsAt);
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      <Card>
        <h3 style={{ marginTop: 0, fontSize: 'var(--ui-text-base)' }}>
          {t('timetableEditor.addHeading')}
        </h3>

        <div
          style={{
            display: 'grid',
            gap: 'var(--ui-space-2)',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          }}
        >
          <Field
            name="day"
            label={t('timetableEditor.day')}
            as="select"
            options={DAYS.map((entry) => ({ value: entry.value, label: t(entry.label) }))}
            value={day}
            onChange={(event) => setDay(event.target.value as Weekday)}
          />

          <Field
            name="startsAt"
            label={t('timetableEditor.starts')}
            type="time"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />

          <Field
            name="endsAt"
            label={t('timetableEditor.ends')}
            type="time"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />

          <Field
            name="subjectId"
            label={t('timetableEditor.subject')}
            as="select"
            options={[
              ...subjects.map((subject) => ({ value: subject.id, label: subject.name })),
              { value: OTHER, label: t('timetableEditor.somethingElse') },
            ]}
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
          />

          {subjectId === OTHER || subjects.length === 0 ? (
            <Field
              name="label"
              // "Period name", not "Name": the subjects panel on the same page has a "Subject
              // name" field, and two fields whose labels are prefixes of one another are ambiguous
              // to a person reading the page as well as to a test selecting on it.
              label={t('timetableEditor.periodName')}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={60}
              hint={t('timetableEditor.periodNameHint')}
            />
          ) : null}
        </div>

        {problem ? (
          // `role="alert"` rather than a quiet red line: this is a response to something the person
          // just did, and it must reach a screen reader.
          <p role="alert" style={{ color: 'var(--ui-danger)', margin: 'var(--ui-space-2) 0 0' }}>
            {problem}
          </p>
        ) : null}

        <p style={{ margin: 'var(--ui-space-3) 0 0' }}>
          <Button type="button" variant="secondary" onClick={add}>
            Add period
          </Button>
        </p>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 'var(--ui-text-base)' }}>
          This week ({draft.length} {draft.length === 1 ? 'period' : 'periods'})
        </h3>

        {draft.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing added yet. Publishing an empty week is not how you remove a timetable — it would
            read as “no lessons at all”.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-2)' }}>
            {draft.map((period, index) => (
              <li
                key={`${period.day}-${period.startsAt}-${String(index)}`}
                style={{ display: 'flex', gap: 'var(--ui-space-2)', alignItems: 'center' }}
              >
                <span style={{ flex: 1 }}>{describe(period, subjects, t)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDraft((current) => current.filter((_, at) => at !== index));
                  }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ActionForm
        action={publishTimetableAction.bind(null, classId)}
        submitLabel={t('timetableEditor.submit')}
        pendingLabel={t('timetableEditor.publishing')}
        successMessage={t('timetableEditor.published')}
      >
        {/*
         * The draft travels as JSON in a hidden field. A Server Action takes a FormData, and a week
         * is a list of objects; spreading it across indexed field names would mean parsing them
         * back out on the server, which is more code and more ways to be wrong than one string.
         */}
        <input type="hidden" name="periods" value={JSON.stringify(draft)} />
      </ActionForm>
    </div>
  );
}
