import type { ReactNode } from 'react';

export interface SubmitButtonProps {
  /** Whether the mutation is currently running. Disables the button. */
  isSubmitting: boolean;
  /** Label shown when idle. */
  label?: string;
  /** Label shown while submitting. */
  submittingLabel?: string;
  children?: ReactNode;
}

/**
 * Submit button that disables itself + shows a "Saving…" hint while
 * the mutation is in flight, preventing duplicate submissions.
 */
export function SubmitButton({
  isSubmitting,
  label = 'Save',
  submittingLabel = 'Saving…',
  children,
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className="btn btn--primary"
      disabled={isSubmitting}
      data-testid="form-submit"
    >
      {isSubmitting ? submittingLabel : (children ?? label)}
    </button>
  );
}