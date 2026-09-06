/**
 * Reusable form primitives (Phase 7B).
 *
 *   <FormField id="title" label="Title" required error={errors.title}>
 *     <input ... />
 *   </FormField>
 *
 * Labels + inputs are associated via `htmlFor` / `id` so screen readers
 * announce them correctly. Errors use `aria-describedby`.
 */
import type { ReactNode } from 'react';

export interface FormFieldProps {
  id: string;
  label: string;
  /** Optional helper text shown below the label. */
  hint?: string;
  /** Server-side or client-side validation error. */
  error?: string | null;
  /** Mark the label with a required indicator. */
  required?: boolean;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FormFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
        {required && (
          <span aria-hidden="true" className="form-field__required">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="form-field__hint">
          {hint}
        </p>
      )}
      {/* Pass aria-describedby down via a wrapper data attribute so any
          input rendered as `children` can pick it up. */}
      <div
        data-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
      >
        {children}
      </div>
      {error && (
        <p id={errorId} role="alert" className="form-field__error">
          {error}
        </p>
      )}
    </div>
  );
}