'use client';

/**
 * Labelled form control with hint and error — input, textarea, or select.
 *
 * The accessibility here is the whole point of the component. Getting it right once, centrally,
 * is the difference between a form that works with a screen reader and one that technically has
 * labels:
 *
 * - The label is a real `<label for>`, not a placeholder. Placeholders vanish on input and are not
 *   announced as names.
 * - Hint and error are wired through `aria-describedby`, so they are read *with* the field rather
 *   than orphaned next to it.
 * - `aria-invalid` marks the control itself, so a screen reader announces the error state on focus,
 *   not only when the user happens to reach the message.
 * - The error is `role="alert"`, so it is announced when it appears after a failed submit.
 *
 * The three control types share one component rather than three, because everything above is the
 * part that gets forgotten, and it is identical in all three.
 */
import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export interface FieldOption {
  value: string;
  label: string;
}

interface FieldShared {
  label: ReactNode;
  /** Guidance shown before the user makes a mistake — cheaper than an error afterwards. */
  hint?: ReactNode;
  error?: ReactNode;
}

type InputFieldProps = FieldShared & { as?: 'input' } & Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'id'
  >;

type TextareaFieldProps = FieldShared & { as: 'textarea' } & Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'className' | 'id'
  >;

type SelectFieldProps = FieldShared & {
  as: 'select';
  options: FieldOption[];
  /** Prepends a non-selectable prompt, for when there is no sensible default. */
  placeholder?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id' | 'placeholder'>;

export type FieldProps = InputFieldProps | TextareaFieldProps | SelectFieldProps;

export function Field(props: FieldProps) {
  const { label, hint, error, required } = props;

  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined]
    .filter(Boolean)
    .join(' ');

  const shared = {
    id,
    required,
    className: 'ui-field__input',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy.length > 0 ? describedBy : undefined,
  } as const;

  let control: ReactNode;

  if (props.as === 'textarea') {
    const { label: _label, hint: _hint, error: _error, as: _as, ...rest } = props;
    control = <textarea {...rest} {...shared} />;
  } else if (props.as === 'select') {
    const {
      label: _label,
      hint: _hint,
      error: _error,
      as: _as,
      options,
      placeholder,
      ...rest
    } = props;

    control = (
      <select {...rest} {...shared}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else {
    const { label: _label, hint: _hint, error: _error, as: _as, ...rest } = props;
    control = <input {...rest} {...shared} />;
  }

  return (
    <div className="ui-field">
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required ? (
          <>
            {' '}
            <span className="ui-field__required" aria-hidden="true">
              *
            </span>
            <span className="ui-visually-hidden">(required)</span>
          </>
        ) : null}
      </label>

      {control}

      {hint ? (
        <span className="ui-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}

      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
