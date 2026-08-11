'use client';

/**
 * Recording syllabus coverage, for a teacher.
 *
 * The topic is a free-text field rather than a picker: the schema has no syllabus structure to
 * pick from, and inventing one here would put a list on screen that no school has agreed to.
 * Re-recording the same topic updates it, which is what makes this safe to type into twice.
 */
import { Field } from '@connected/ui';

import { recordSyllabusAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';
import { formatShortDate } from '@/lib/i18n/format';
import { useTranslations } from './locale-provider';

import type { SyllabusCoverageResponse } from '@connected/types';

function TopicField() {
  const { t } = useTranslations();

  return (
    <Field
      name="topic"
      label={t('syllabusPanel.topic')}
      required
      maxLength={200}
      error={useFieldError('topic')}
      hint={t('syllabusPanel.topicHint')}
    />
  );
}

function PercentField() {
  const { t } = useTranslations();

  return (
    <Field
      name="percent"
      label={t('syllabusPanel.covered')}
      type="number"
      min={0}
      max={100}
      step={1}
      required
      error={useFieldError('percent')}
    />
  );
}

export function CoverageBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      // The number is in the label too: a bar alone conveys nothing to a screen reader, and
      // nothing at all if the fill colour fails to render.
      aria-label={`${label}: ${percent}% covered`}
      className="coverage-bar"
    >
      <span className="coverage-bar__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function SyllabusPanel({
  coverage,
  canRecord,
}: {
  coverage: SyllabusCoverageResponse;
  canRecord: boolean;
}) {
  const { t, locale } = useTranslations();

  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      <div>
        <p style={{ margin: '0 0 var(--ui-space-2)' }}>
          <strong>{coverage.overallPercent}%</strong> covered overall
        </p>
        <CoverageBar
          percent={coverage.overallPercent}
          label={coverage.subjectName ?? t('syllabusPanel.subjectFallback')}
        />
      </div>

      {coverage.topics.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Nothing recorded yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 'var(--ui-space-3)' }}>
          {coverage.topics.map((topic) => (
            <li key={topic.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--ui-space-3)',
                }}
              >
                <span>{topic.topic}</span>
                <span className="muted">{topic.percent}%</span>
              </div>

              <CoverageBar percent={topic.percent} label={topic.topic} />

              <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: 'var(--ui-text-sm)' }}>
                {topic.updatedByName ?? 'Staff'} · {formatShortDate(topic.updatedAt, locale)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canRecord ? (
        <ActionForm
          action={recordSyllabusAction.bind(null, coverage.subjectId)}
          submitLabel={t('syllabusPanel.submit')}
          pendingLabel={t('syllabusPanel.recording')}
          successMessage={t('syllabusPanel.recorded')}
          resetOnSuccess
        >
          <TopicField />
          <PercentField />
        </ActionForm>
      ) : null}
    </div>
  );
}
