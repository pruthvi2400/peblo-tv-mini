import type { ReactNode } from 'react';

export interface PermissionDeniedProps {
  title?: string;
  message?: string;
  children?: ReactNode;
}

/**
 * 403 placeholder. Distinguishes from a generic error so editors who
 * stumble into an admin-only area understand why they're blocked.
 */
export function PermissionDenied({
  title = 'Permission denied',
  message = 'You do not have permission to view this area. Please contact an admin if you believe this is a mistake.',
  children,
}: PermissionDeniedProps) {
  return (
    <div className="state state--denied" role="alert">
      <h2 className="state__title">{title}</h2>
      <p className="state__description">{message}</p>
      {children}
    </div>
  );
}