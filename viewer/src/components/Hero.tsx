// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { Link } from 'react-router-dom';
import type { CatalogShow, CatalogSection } from '../types/catalog';
import { ImageWithFallback } from './ImageWithFallback';
import { pickHeroArtwork } from './artwork';

interface HeroProps { sections: CatalogSection[]; }

function findFeaturedSection(sections: CatalogSection[]): CatalogShow | null {
  const featured = sections.find((s) => s.key === 'featured');
  if (featured && featured.shows.length > 0) return featured.shows[0] ?? null;
  return null;
}

export function Hero({ sections }: HeroProps) {
  const show = findFeaturedSection(sections);
  if (!show) {
    return (
      <section className="hero hero--empty" data-testid="hero-empty">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Peblo TV</h1>
          <p className="hero-synopsis">Browse the catalogue of mini series, songs and short clips.</p>
        </div>
      </section>
    );
  }
  const heroSource = show.trailers[0] ?? show.seasons[0]?.episodes[0] ?? null;
  const heroArtwork = heroSource?.artwork ?? {};
  const heroUrl = pickHeroArtwork(heroArtwork);
  return (
    <section className="hero" data-testid="hero">
      <div className="hero-backdrop">
        <ImageWithFallback src={heroUrl} alt={show.title + ' banner'} className="hero-backdrop-image" imgClassName="hero-backdrop-img" />
        <div className="hero-backdrop-overlay" />
      </div>
      <div className="hero-content">
        <h1 className="hero-title" data-testid="hero-title">{show.title}</h1>
        {show.synopsis ? <p className="hero-synopsis">{show.synopsis}</p> : null}
        <ul className="hero-meta">
          {show.categories.length > 0 && <li className="hero-meta-item" data-testid="hero-categories">{show.categories.join(' · ')}</li>}
          {show.trailers.length > 0 && <li className="hero-meta-item">{show.trailers.length} {show.trailers.length === 1 ? 'trailer' : 'trailers'}</li>}
          {show.seasons.length > 0 && <li className="hero-meta-item">{show.seasons.length} {show.seasons.length === 1 ? 'season' : 'seasons'}</li>}
        </ul>
        <div className="hero-actions">
          <Link to={'/shows/' + encodeURIComponent(show.slug)} className="hero-button hero-button--primary" data-testid="hero-cta">View details</Link>
        </div>
      </div>
    </section>
  );
}
