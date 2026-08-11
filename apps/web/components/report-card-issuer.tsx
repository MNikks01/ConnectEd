'use client';

/**
 * Issuing a class's report cards, for the class teacher (FR-GRADE-040).
 *
 * **One action for the whole class**, which is why there is one button and not one per pupil. A
 * term in which some families have a card and others do not is itself information about who the
 * school got to, and issuing per class removes the question.
 *
 * The comments grow into the form only once cards exist. That is not a limitation dressed up: the
 * pupils on this form come from the cards themselves, and before the first issue there is nothing
 * to write a comment against. The first pass creates the documents; the second says something about
 * them. A teacher who has nothing to add never needs the second pass.
 */
import { Card, Field } from '@connected/ui';

import { issueReportCardsAction } from '@/app/(app)/(member)/actions';
import { ActionForm, useFieldError } from './action-form';
import { useTranslations } from './locale-provider';

import type { ReportCardResponse, TermResponse } from '@connected/types';

function TermField({ terms, selected }: { terms: TermResponse[]; selected: string }) {
  const { t } = useTranslations();

  return (
    <Field
      name="termId"
      label={t('reportCardIssuer.term')}
      as="select"
      required
      defaultValue={selected}
      error={useFieldError('termId')}
      options={terms.map((term) => ({
        value: term.id,
        label: `${term.name} (${term.startDate} to ${term.endDate})`,
      }))}
    />
  );
}

export function ReportCardIssuer({
  classId,
  terms,
  selectedTermId,
  cards,
}: {
  classId: string;
  terms: TermResponse[];
  selectedTermId: string;
  cards: ReportCardResponse[];
}) {
  const { t } = useTranslations();

  if (terms.length === 0) {
    // Not a disabled button: a class teacher cannot fix this, and saying who can is more use than
    // a control that does nothing.
    return (
      <Card>
        <p style={{ margin: 0 }}>
          Your school has not set up any terms yet, so there is nothing to issue against. Ask the
          school to add one.
        </p>
      </Card>
    );
  }

  const issued = cards.length > 0;

  return (
    <ActionForm
      action={(formData) => issueReportCardsAction(classId, formData)}
      submitLabel={issued ? t('reportCardIssuer.reissue') : t('reportCardIssuer.issue')}
      pendingLabel={issued ? t('reportCardIssuer.reissuing') : t('reportCardIssuer.issuing')}
      successMessage={issued ? t('reportCardIssuer.reissued') : t('reportCardIssuer.issued')}
    >
      <p style={{ color: 'var(--ui-color-text-muted)', marginTop: 0 }}>
        {issued ? t('reportCardIssuer.reissueNote') : t('reportCardIssuer.firstIssueNote')}
      </p>

      <TermField terms={terms} selected={selectedTermId} />

      {issued ? (
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ padding: 0, fontWeight: 600 }}>{t('reportCardIssuer.comments')}</legend>
          <p style={{ color: 'var(--ui-color-text-muted)', marginTop: 0 }}>
            {t('reportCardIssuer.commentsNote')}
          </p>

          <div style={{ display: 'grid', gap: 'var(--ui-space-3)' }}>
            {cards.map((card) => (
              <Field
                key={card.studentAccountId}
                name={`comment-${card.studentAccountId}`}
                label={card.studentName}
                as="textarea"
                rows={2}
                maxLength={2000}
                defaultValue={card.comment ?? ''}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
    </ActionForm>
  );
}
