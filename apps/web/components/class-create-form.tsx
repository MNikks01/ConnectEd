'use client';

import { ClassLevel, Medium, Section } from '@connected/types';

import { createClassAction } from '@/app/(app)/school/actions';
import { ActionForm, useFieldError } from './action-form';
import type { MessageKey } from '@/lib/i18n/translate';
import { useTranslations } from './locale-provider';

/**
 * The taxonomy is closed, so these are selects rather than free text. The API would reject an
 * invalid value anyway; offering only valid ones means the user never has to discover that.
 */
const LEVEL_LABELS: Record<string, MessageKey> = {
  PRE_NURSERY: 'classForm.levelPRE_NURSERY',
  NURSERY: 'classForm.levelNURSERY',
  KG1: 'classForm.levelKG1',
  KG2: 'classForm.levelKG2',
  CLASS_1: 'classForm.levelCLASS_1',
  CLASS_2: 'classForm.levelCLASS_2',
  CLASS_3: 'classForm.levelCLASS_3',
  CLASS_4: 'classForm.levelCLASS_4',
  CLASS_5: 'classForm.levelCLASS_5',
  CLASS_6: 'classForm.levelCLASS_6',
  CLASS_7: 'classForm.levelCLASS_7',
  CLASS_8: 'classForm.levelCLASS_8',
  CLASS_9: 'classForm.levelCLASS_9',
  CLASS_10: 'classForm.levelCLASS_10',
  CLASS_11: 'classForm.levelCLASS_11',
  CLASS_12: 'classForm.levelCLASS_12',
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
  const { t } = useTranslations();

  return (
    <ActionForm
      action={createClassAction.bind(null, schoolId)}
      submitLabel={t('classForm.submit')}
      pendingLabel={t('classForm.adding')}
      successMessage={t('classForm.added')}
    >
      <Select
        name="medium"
        label={t('classForm.medium')}
        options={Object.values(Medium).map((value) => ({
          value,
          label: value === 'ENGLISH' ? t('classForm.english') : t('classForm.hindi'),
        }))}
      />
      <Select
        name="level"
        label={t('classForm.level')}
        options={Object.values(ClassLevel).map((value) => ({
          value,
          label: value in LEVEL_LABELS ? t(LEVEL_LABELS[value] as MessageKey) : value,
        }))}
      />
      <Select
        name="section"
        label={t('classForm.section')}
        options={Object.values(Section).map((value) => ({ value, label: value }))}
      />
    </ActionForm>
  );
}
