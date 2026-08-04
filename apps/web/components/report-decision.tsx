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

const DECISIONS = [
  { value: 'ACTIONED', label: 'Remove it' },
  { value: 'DISMISSED', label: 'Leave it' },
  { value: 'REVIEWED', label: 'Needs a second look' },
];

export function ReportDecision({ reportId, removable }: { reportId: string; removable: boolean }) {
  return (
    <ActionForm
      action={decideReportAction.bind(null, reportId)}
      submitLabel="Record decision"
      pendingLabel="Recording…"
      successMessage="Recorded."
    >
      <Field
        name="decision"
        label="Decision"
        as="select"
        required
        options={DECISIONS.filter(
          // Removing is offered only where it can actually happen. An option that would fail is
          // worse than an absent one: it teaches a reviewer that the control is decorative.
          (decision) => decision.value !== 'ACTIONED' || removable,
        )}
        hint={
          removable
            ? 'Removing takes the content down immediately.'
            : 'This kind of report cannot be removed from here — suspending an account is not a queue action.'
        }
      />

      <Field
        name="note"
        label="Note"
        as="textarea"
        rows={3}
        maxLength={2000}
        hint="Recorded against your account in the audit trail. Nobody outside the team sees it."
      />
    </ActionForm>
  );
}
