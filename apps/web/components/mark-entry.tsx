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
import { useTranslations } from './locale-provider';

import type { AssessmentWithMarksResponse, StaffMarkResponse } from '@connected/types';

interface Props {
  assessment: AssessmentWithMarksResponse;
  classId: string;
  roster: { accountId: string; name: string }[];
}

function markFor(marks: StaffMarkResponse[], accountId: string): StaffMarkResponse | undefined {
  return marks.find((mark) => mark.studentAccountId === accountId);
}

export function MarkEntry({ assessment, classId, roster }: Props) {
  const { t } = useTranslations();

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
              submitLabel={t('markEntry.correctFor', { name: mark.studentName })}
              pendingLabel={t('markEntry.correcting')}
              successMessage={t('markEntry.corrected')}
            >
              <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                <span>{t('markEntry.newScoreFor', { name: mark.studentName })}</span>
                <input
                  name="score"
                  defaultValue={mark.score ?? ''}
                  inputMode="decimal"
                  placeholder="—"
                  style={{ padding: 'var(--ui-space-2)' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                <span>{t('markEntry.remarkFor', { name: mark.studentName })}</span>
                <input
                  name="remark"
                  defaultValue={mark.remark ?? ''}
                  maxLength={1000}
                  style={{ padding: 'var(--ui-space-2)' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                <span>{t('markEntry.staffNoteFor', { name: mark.studentName })}</span>
                <input
                  name="staffNote"
                  defaultValue={mark.staffNote ?? ''}
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
        submitLabel={t('markEntry.saveDraft')}
        pendingLabel={t('markEntry.saving')}
        successMessage={t('markEntry.savedDraft')}
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
                <div style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                  <span>{pupil.name}</span>
                  <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                    <span style={{ fontSize: 'var(--ui-font-size-1)' }}>
                      {t('markEntry.remarkForPupil', { name: pupil.name })}
                    </span>
                    <input
                      name={`remark-${pupil.accountId}`}
                      defaultValue={existing?.remark ?? ''}
                      maxLength={1000}
                      style={{ padding: 'var(--ui-space-2)' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                    {/* Labelled for who reads it, not for what it is. "Private note" tells a
                        teacher nothing about who "private" excludes. */}
                    <span style={{ fontSize: 'var(--ui-font-size-1)' }}>
                      {t('markEntry.staffNoteFor', { name: pupil.name })}
                    </span>
                    <input
                      name={`staff-note-${pupil.accountId}`}
                      defaultValue={existing?.staffNote ?? ''}
                      maxLength={1000}
                      style={{ padding: 'var(--ui-space-2)' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'grid', gap: 'var(--ui-space-1)' }}>
                  {/* Named for the pupil, so a screen reader announces whose box this is rather
                      than "Score" thirty times. */}
                  <span>{t('markEntry.scoreFor', { name: pupil.name })}</span>
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
        <h3 style={{ marginTop: 0, fontSize: 'var(--ui-font-size-2)' }}>
          {t('markEntry.publishHeading')}
        </h3>
        <p style={{ marginTop: 0 }}>{t('markEntry.publishExplained')}</p>

        {confirming ? (
          <ActionForm
            action={() => publishMarksAction(assessment.id, classId)}
            submitLabel={t('markEntry.publishConfirm')}
            pendingLabel={t('markEntry.publishing')}
            successMessage={t('markEntry.published')}
          >
            <p style={{ margin: 0 }}>
              {t(
                roster.length === 1
                  ? 'markEntry.publishQuestionOne'
                  : 'markEntry.publishQuestionMany',
                { title: assessment.title, count: roster.length },
              )}
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
