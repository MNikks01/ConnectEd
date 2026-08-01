'use client';

import { ClassLevel, Medium, Section } from '@connected/types';

import { createClassAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';

/**
 * The taxonomy is closed, so these are selects rather than free text. The API would reject an
 * invalid value anyway; offering only valid ones means the user never has to discover that.
 */
const LEVEL_LABELS: Record<string, string> = {
  PRE_NURSERY: 'Pre-Nursery',
  NURSERY: 'Nursery',
  KG1: 'KG-1',
  KG2: 'KG-2',
  CLASS_1: 'Class 1',
  CLASS_2: 'Class 2',
  CLASS_3: 'Class 3',
  CLASS_4: 'Class 4',
  CLASS_5: 'Class 5',
  CLASS_6: 'Class 6',
  CLASS_7: 'Class 7',
  CLASS_8: 'Class 8',
  CLASS_9: 'Class 9',
  CLASS_10: 'Class 10',
  CLASS_11: 'Class 11',
  CLASS_12: 'Class 12',
};

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const error = useFieldError(name);
  const errorId = `${name}-error`;

  return (
    <div className="ui-field" style={{ marginBottom: 'var(--ui-space-4)' }}>
      <label className="ui-field__label" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        className="ui-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        defaultValue={options[0]?.value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function ClassCreateForm({ schoolId }: { schoolId: string }) {
  return (
    <ActionForm
      action={createClassAction.bind(null, schoolId)}
      submitLabel="Add class"
      pendingLabel="Adding…"
      successMessage="Class added."
    >
      <Select
        name="medium"
        label="Medium"
        options={Object.values(Medium).map((value) => ({
          value,
          label: value === 'ENGLISH' ? 'English' : 'Hindi',
        }))}
      />
      <Select
        name="level"
        label="Level"
        options={Object.values(ClassLevel).map((value) => ({
          value,
          label: LEVEL_LABELS[value] ?? value,
        }))}
      />
      <Select
        name="section"
        label="Section"
        options={Object.values(Section).map((value) => ({ value, label: value }))}
      />
    </ActionForm>
  );
}
