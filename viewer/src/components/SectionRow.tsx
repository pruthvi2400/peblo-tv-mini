// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import type { CatalogSection } from '../types/catalog';
import { ShowCard } from './ShowCard';

interface SectionRowProps { section: CatalogSection; }

export function SectionRow({ section }: SectionRowProps) {
  if (section.shows.length === 0) return null;
  return (
    <section className="section-row" data-testid="section-row">
      <h2 className="section-title" data-testid="section-title">{section.key}</h2>
      <div className="section-shows">
        {section.shows.map((show) => (
          <ShowCard key={show.slug} show={show} />
        ))}
      </div>
    </section>
  );
}
