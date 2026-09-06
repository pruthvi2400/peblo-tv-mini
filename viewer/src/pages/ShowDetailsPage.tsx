// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SeasonList, TrailerList } from '../components/EpisodeList';
import { getCatalog } from '../api/client';
import type { Catalog } from '../types/catalog';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { pickPosterArtwork, pickHeroArtwork } from '../components/artwork';

export function ShowDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: catalog, isLoading, error } = useQuery<Catalog, Error>({
    queryKey: ['catalog'],
    queryFn: getCatalog,
  });

  const show = catalog?.sections.flatMap((s) => s.shows).find((s) => s.slug === slug);

  if (isLoading) {
    return (
      <div className="loading-state" data-testid="show-loading">
        <div className="spinner"></div>
        <span className="loading-state__text">Loading show...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-state" data-testid="show-error">
        <h2 className="error-state__title">Something went wrong</h2>
        <p className="error-state__message">{error.message}</p>
      </div>
    );
  }
  if (!show) {
    return (
      <div className="empty-state" data-testid="show-not-found">
        <h2 className="empty-state__title">Show not found</h2>
        <p className="empty-state__message">The show you are looking for does not exist.</p>
        <Link to="/" className="hero-button hero-button--primary">Back to Home</Link>
      </div>
    );
  }
  if (show.seasons.length === 0 && show.trailers.length === 0) {
    return (
      <div className="empty-state" data-testid="show-no-content">
        <h2 className="empty-state__title">No content available</h2>
        <p className="empty-state__message">This show does not have any episodes or trailers.</p>
        <Link to="/" className="hero-button hero-button--primary">Back to Home</Link>
      </div>
    );
  }

  // Get hero artwork
  const heroSource = show.trailers[0] ?? show.seasons[0]?.episodes[0] ?? null;
  const heroArtwork = heroSource?.artwork ?? {};
  const heroUrl = pickHeroArtwork(heroArtwork);
  const posterUrl = pickPosterArtwork(heroArtwork);

  return (
    <div className="show-page" data-testid="show-page">
      <Link to="/" className="show-back-link" data-testid="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
        Back to Home
      </Link>
      <div className="show-hero">
        <div className="show-hero-backdrop">
          <ImageWithFallback src={heroUrl} alt={show.title + ' backdrop'} className="show-hero-backdrop-image" />
          <div className="show-hero-backdrop-overlay" />
        </div>
        <div className="show-hero-content">
          <div className="show-hero-poster">
            <ImageWithFallback src={posterUrl} alt={show.title + ' poster'} className="show-hero-poster-image" />
          </div>
          <div className="show-hero-info">
            <h1 className="show-hero-title" data-testid="show-title">{show.title}</h1>
            <p className="show-categories" data-testid="show-categories">{show.categories.join(', ')}</p>
            {show.synopsis && (
              <p className="show-hero-synopsis" data-testid="show-synopsis">{show.synopsis}</p>
            )}
            <div className="show-hero-meta">
              {show.trailers.length > 0 && (
                <span className="show-hero-meta-badge">{show.trailers.length} {show.trailers.length === 1 ? 'Trailer' : 'Trailers'}</span>
              )}
              {show.seasons.length > 0 && (
                <span className="show-hero-meta-badge">{show.seasons.length} {show.seasons.length === 1 ? 'Season' : 'Seasons'}</span>
              )}
            </div>
            <div className="show-hero-actions">
              {show.trailers.length > 0 && (
                <button className="show-hero-button show-hero-button--primary">Play Trailer</button>
              )}
              {show.seasons.length > 0 && (
                <button className="show-hero-button show-hero-button--secondary">Browse Episodes</button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="show-content">
        {show.trailers.length > 0 && <TrailerList trailers={show.trailers} />}
        {show.seasons.map((season) => <SeasonList key={season.season_number} season={season} />)}
      </div>
    </div>
  );
}
