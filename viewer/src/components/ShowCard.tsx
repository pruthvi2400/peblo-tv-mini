// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import type { CatalogShow } from '../types/catalog';

interface ShowCardProps { show: CatalogShow; }

export function ShowCard({ show }: ShowCardProps) {
  return (
    <div className="show-card" data-testid="show-card">
      <div className="show-card-poster">
        <div className="show-card-poster-placeholder" />
      </div>
      <h3 className="show-card-title" data-testid="show-card-title">{show.title}</h3>
      <p className="show-card-meta" data-testid="show-meta">{show.categories.join(', ')}</p>
    </div>
  );
}
