// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { Link } from 'react-router-dom';
import type { CatalogSection } from '../types/catalog';
import { ShowCard } from './ShowCard';
import { sectionLabel } from '../types/catalog';

interface SectionRowProps { section: CatalogSection; }

export function SectionRow({ section }: SectionRowProps) {
  if (section.shows.length === 0) return null;
  return (
    <section className="section-row" data-testid="section-row">
      <div className="section-header">
        <h2 className="section-title" data-testid="section-title">{sectionLabel(section.key)}</h2>
        <Link to={`/search?section=${encodeURIComponent(section.key)}`} className="section-view-all">View all</Link>
      </div>
      <div className="section-shows">
        {section.shows.map((show) => (
          <ShowCard key={show.slug} show={show} />
        ))}
      </div>
    </section>
  );
}
