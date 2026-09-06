import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  children?: ReactNode;
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="state state--empty" role="status">
      <h2 className="state__title">{title}</h2>
      {description && <p className="state__description">{description}</p>}
      {children}
    </div>
  );
}