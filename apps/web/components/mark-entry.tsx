'use client';

/**
 * The marking grid: one row per pupil, entered in one sitting and saved in one submission.
 *
 * A row per pupil rather than a page per pupil, because marking is done against a pile of scripts
 * and thirty navigations is not a workflow. Saving is one request for the same reason — a partial
 * save would leave an assessment half-entered with nothing on screen saying which half.
 *
 * **An empty box is "not marked", not zero.** That is the one thing about this form that must not
 * be convenient: a teacher who tabs past a pupil has not given them nothing, they have not marked
 * them yet, and the two are different facts about a child.
 */
import { Card } from '@connected/ui';
import { useState } from 'react';

import {
  correctMarkAction,
  enterMarksAction,
  publishMarksAction,
} from '@/app/(app)/(member)/actions';
import { ActionForm } from './action-form';

import type { AssessmentWithMarksResponse, MarkResponse } from '@connected/types';

interface Props {
  assessment: AssessmentWithMarksResponse;
  classId: string;
  roster: { accountId: string; name: string }[];
}

function markFor(marks: MarkResponse[], accountId: string): MarkResponse | undefined {
  return marks.find((mark) => mark.studentAccountId === accountId);
}

export function MarkEntry({ assessment, classId, roster }: Props) {
  const published = assessment.publishedAt !== null;
  const [confirming, setConfirming] = useState(false);

  if (published) {
    return (
      <>
        <Card>
          <p style={{ margin: 0 }}>
            These marks are published and the class can see them. Corrections are made one pupil at
            a time and are recorded.
          </p>
        </Card>

        {/*
          One form per pupil rather than one grid, and that asymmetry with draft entry is the
          point. Entering marks is one task done in one sitting; correcting one is a deliberate act
          about a named child, and it is recorded as such. A grid here would invite exactly the
          bulk overwrite the server refuses.
        */}
        {assessment.marks.map((mark) => (
          <Card key={mark.studentAccountId}>
            <h3 style={{ marginTop: 0, fontSize: 'var(--ui-font-size-2)' }}>{mark.studentName}</h3>
            <p style={{ marginTop: 0, color: 'var(--ui-color-text-muted)' }}>
              Currently{' '}
              {mark.score === null ? 'not marked' : `${mark.score} out of ${assessment.maxScore}`}
              {mark.remark ? ` · ${mark.remark}` : ''}
            </p>

            <ActionForm
              action={(formData) =>
                correctMarkAction(assessment.id, classId, mark.studentAccountId, formData)
              }
              submitLabel={`Correct ${mark.studentName}’s mark`}
              pendingLabel="Correcting…"
              successMessage="Corrected. The change has been recorded."
            >
              <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                <span>New score for {mark.studentName}</span>
                <input
                  name="score"
                  defaultValue={mark.score ?? ''}
                  inputMode="decimal"
                  placeholder="—"
                  style={{ padding: 'var(--ui-space-2)' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                <span>Remark for {mark.studentName}</span>
                <input
                  name="remark"
                  defaultValue={mark.remark ?? ''}
                  maxLength={1000}
                  style={{ padding: 'var(--ui-space-2)' }}
                />
              </label>
            </ActionForm>
          </Card>
        ))}
      </>
    );
  }

  return (
    <>
      <ActionForm
        action={(formData) => enterMarksAction(assessment.id, classId, formData)}
        submitLabel="Save draft"
        pendingLabel="Saving…"
        successMessage="Saved. Nobody can see these yet."
      >
        <p style={{ color: 'var(--ui-color-text-muted)' }}>
          Out of {assessment.maxScore}. Leave a box empty for a pupil who was not marked — that is
          not the same as a zero.
        </p>

        <div style={{ display: 'grid', gap: 'var(--ui-space-3)' }}>
          {roster.map((pupil) => {
            const existing = markFor(assessment.marks, pupil.accountId);

            return (
              <div
                key={pupil.accountId}
                style={{
                  display: 'grid',
                  gap: 'var(--ui-space-2)',
                  // Stacks on a phone rather than squeezing a name, a score and a remark into one
                  // line nobody can read or tap accurately.
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(6rem, 1fr)',
                  alignItems: 'end',
                }}
              >
                <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                  <span>{pupil.name}</span>
                  <input
                    name={`remark-${pupil.accountId}`}
                    defaultValue={existing?.remark ?? ''}
                    placeholder="Remark (optional)"
                    maxLength={1000}
                    style={{ padding: 'var(--ui-space-2)' }}
                  />
                </label>

                <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                  {/* Named for the pupil, so a screen reader announces whose box this is rather
                      than "Score" thirty times. */}
                  <span>Score for {pupil.name}</span>
                  <input
                    name={`score-${pupil.accountId}`}
                    defaultValue={existing?.score ?? ''}
                    inputMode="decimal"
                    placeholder="—"
                    style={{ padding: 'var(--ui-space-2)' }}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </ActionForm>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: 'var(--ui-font-size-2)' }}>Publish</h3>
        <p style={{ marginTop: 0 }}>
          Publishing shows every mark to its pupil and their parents at the same moment. After that,
          changes are made one at a time and recorded.
        </p>

        {confirming ? (
          <ActionForm
            action={() => publishMarksAction(assessment.id, classId)}
            submitLabel="Yes, publish these marks"
            pendingLabel="Publishing…"
            successMessage="Published. The class has been notified."
          >
            <p style={{ margin: 0 }}>
              Publish {assessment.title} to {roster.length}{' '}
              {roster.length === 1 ? 'pupil' : 'pupils'}?
            </p>
          </ActionForm>
        ) : (
          <button type="button" onClick={() => setConfirming(true)}>
            Publish marks
          </button>
        )}
      </Card>
    </>
  );
}
