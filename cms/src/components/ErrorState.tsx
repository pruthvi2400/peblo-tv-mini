import type { ReactNode } from 'react';

export interface ErrorStateProps {
  title?: string;
  /** Human-readable description. NEVER a raw stack trace. */
  message: string;
  /** Optional handler for a "Try again" / "Back" button. */
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}

/**
 * Reusable error placeholder. Callers MUST pass an already-humanised
 * message (the API client returns editor-friendly strings, so just pass
 * `error.message` for the typical case).
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  children,
}: ErrorStateProps) {
  return (
    <div className="state state--error" role="alert">
      <h2 className="state__title">{title}</h2>
      <p className="state__description">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
      {children}
    </div>
  );
}