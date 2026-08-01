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

import type { SyllabusCoverageResponse } from '@connected/types';

function TopicField() {
  return (
    <Field
      name="topic"
      label="Topic"
      required
      maxLength={200}
      error={useFieldError('topic')}
      hint="Recording the same topic again updates it."
    />
  );
}

function PercentField() {
  return (
    <Field
      name="percent"
      label="Covered (%)"
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
  return (
    <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
      <div>
        <p style={{ margin: '0 0 var(--ui-space-2)' }}>
          <strong>{coverage.overallPercent}%</strong> covered overall
        </p>
        <CoverageBar percent={coverage.overallPercent} label={coverage.subjectName ?? 'Subject'} />
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
                {topic.updatedByName ?? 'Staff'} ·{' '}
                {new Date(topic.updatedAt).toLocaleDateString('en-GB')}
              </p>
            </li>
          ))}
        </ul>
      )}

      {canRecord ? (
        <ActionForm
          action={recordSyllabusAction.bind(null, coverage.subjectId)}
          submitLabel="Record coverage"
          pendingLabel="Recording…"
          successMessage="Coverage recorded."
          resetOnSuccess
        >
          <TopicField />
          <PercentField />
        </ActionForm>
      ) : null}
    </div>
  );
}
