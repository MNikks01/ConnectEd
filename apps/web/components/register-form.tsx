'use client';

/**
 * Taking a register (FR-ATT-001, FR-ATT-010).
 *
 * Radio buttons per pupil rather than a dropdown each: a register is taken standing up, in front of
 * a class, and four visible choices are one tap where a select is three. The whole class submits at
 * once for the same reason the marking grid does.
 *
 * **What the school already agreed to is offered, not asserted.** A pupil with accepted leave
 * arrives pre-set to Excused and says so, and the teacher can still change it — the leave is a
 * fact, the register is their judgement.
 */
import { Card } from '@connected/ui';

import { takeRegisterAction } from '@/app/(app)/(member)/actions';
import { ActionForm } from './action-form';

import type { AttendanceState, RegisterResponse } from '@connected/types';

const STATES: { value: AttendanceState; label: string }[] = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' },
  { value: 'EXCUSED', label: 'Excused' },
];

export function RegisterForm({ register }: { register: RegisterResponse }) {
  if (register.entries.length === 0) {
    return (
      <Card>
        <p style={{ margin: 0 }}>This class has no verified pupils yet, so there is no register.</p>
      </Card>
    );
  }

  return (
    <ActionForm
      action={(formData) => takeRegisterAction(register.classId, register.onDate, formData)}
      submitLabel={register.takenAt ? 'Save changes' : 'Take the register'}
      pendingLabel="Saving…"
      successMessage="Saved."
    >
      <p style={{ color: 'var(--ui-color-text-muted)' }}>
        {register.takenAt
          ? 'This register has been taken. Changes to it are recorded.'
          : 'Nobody has taken this register yet.'}
      </p>

      <div style={{ display: 'grid', gap: 'var(--ui-space-4)' }}>
        {register.entries.map((entry) => (
          <fieldset
            key={entry.studentAccountId}
            style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 'var(--ui-space-2)' }}
          >
            {/* A legend rather than a label, because the control is a group of four. */}
            <legend style={{ padding: 0 }}>
              {entry.studentName}
              {entry.fromLeave ? (
                <span style={{ color: 'var(--ui-color-text-muted)' }}>
                  {' '}
                  — the school accepted leave for this day
                </span>
              ) : null}
            </legend>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--ui-space-3)' }}>
              {STATES.map((state) => (
                <label
                  key={state.value}
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--ui-space-1)' }}
                >
                  <input
                    type="radio"
                    name={`state-${entry.studentAccountId}`}
                    value={state.value}
                    defaultChecked={entry.state === state.value}
                  />
                  <span>{state.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </ActionForm>
  );
}
