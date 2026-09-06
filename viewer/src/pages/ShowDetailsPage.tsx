// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SeasonList, TrailerList } from '../components/EpisodeList';
import { getCatalog } from '../api/client';
import type { Catalog } from '../types/catalog';

export function ShowDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: catalog, isLoading, error } = useQuery<Catalog, Error>({
    queryKey: ['catalog'],
    queryFn: getCatalog,
  });

  const show = catalog?.sections.flatMap((s) => s.shows).find((s) => s.slug === slug);

  if (isLoading) return <div data-testid="show-loading">Loading...</div>;
  if (error) return <div data-testid="show-error">Error: {error.message}</div>;
  if (!show) return <div data-testid="show-not-found">Show not found</div>;
  if (show.seasons.length === 0 && show.trailers.length === 0) {
    return <div data-testid="show-no-content">No content available</div>;
  }

  return (
    <div className="show-page" data-testid="show-page">
      <Link to="/" className="back-link" data-testid="back-link">Back to Home</Link>
      <div className="show-header">
        <div className="show-info">
          <h1 data-testid="show-title">{show.title}</h1>
          <p className="show-categories" data-testid="show-categories">{show.categories.join(', ')}</p>
          {show.synopsis && <p className="show-synopsis" data-testid="show-synopsis">{show.synopsis}</p>}
        </div>
      </div>
      {show.trailers.length > 0 && <TrailerList trailers={show.trailers} />}
      {show.seasons.map((season) => <SeasonList key={season.season_number} season={season} />)}
    </div>
  );
}
