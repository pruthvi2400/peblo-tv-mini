/**
 * Renders a generic, form-level error message (not tied to a single field).
 * Use for unexpected submission failures, 5xx, network errors.
 */
import { ErrorState } from '../ErrorState';

export function FormErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return <ErrorState title="Submission failed" message={message} />;
}