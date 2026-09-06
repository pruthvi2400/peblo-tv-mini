import type { ReactNode } from 'react';

export interface LoadingStateProps {
  label?: string;
  children?: ReactNode;
}

/** Generic "loading…" indicator. Uses role="status" so it's announced. */
export function LoadingState({ label = 'Loading…', children }: LoadingStateProps) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <div className="state__spinner" aria-hidden="true" />
      <p>{label}</p>
      {children}
    </div>
  );
}