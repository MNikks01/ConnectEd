'use client';

/**
 * The decision a reviewer makes on a report (S6-6).
 *
 * Every label says what will actually happen, in the present tense, because the consequences
 * differ and one of them is irreversible-looking to the person whose words disappear:
 *
 * - **Remove it** takes the content down. It says so.
 * - **Leave it** is a decision, not an absence of one — a dismissed report has been read.
 * - **Needs a second look** exists so a queue can be triaged without forcing a verdict nobody is
 *   ready to give. Without it, "leave it" becomes the default for anything difficult.
 *
 * The note is for the audit trail and the form says so, so nobody writes a message to the reporter
 * in a box only staff will ever read.
 */
import { Field } from '@connected/ui';

import { decideReportAction } from '@/app/(app)/admin/actions';
import { ActionForm } from './action-form';
import { useTranslations } from './locale-provider';

const DECISIONS = [
  { value: 'ACTIONED', label: 'reportDecision.remove' },
  { value: 'DISMISSED', label: 'reportDecision.leave' },
  { value: 'REVIEWED', label: 'reportDecision.secondLook' },
];

export function ReportDecision({ reportId, removable }: { reportId: string; removable: boolean }) {
  const { t } = useTranslations();

  return (
    <ActionForm
      action={decideReportAction.bind(null, reportId)}
      submitLabel={t('reportDecision.submit')}
      pendingLabel={t('reportDecision.recording')}
      successMessage={t('reportDecision.recorded')}
    >
      <Field
        name="decision"
        label={t('reportDecision.decision')}
        as="select"
        required
        options={DECISIONS.filter(
          // Removing is offered only where it can actually happen. An option that would fail is
          // worse than an absent one: it teaches a reviewer that the control is decorative.
          (decision) => decision.value !== 'ACTIONED' || removable,
        )}
        hint={removable ? t('reportDecision.removableHint') : t('reportDecision.notRemovableHint')}
      />

      <Field
        name="note"
        label={t('reportDecision.note')}
        as="textarea"
        rows={3}
        maxLength={2000}
        hint={t('reportDecision.noteHint')}
      />
    </ActionForm>
  );
}
