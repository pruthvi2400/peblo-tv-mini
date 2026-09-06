// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { Link } from 'react-router-dom';
import type { CatalogShow } from '../types/catalog';
import { ImageWithFallback } from './ImageWithFallback';
import { pickPosterArtwork } from './artwork';

interface ShowCardProps { show: CatalogShow; }

function getShowArtwork(show: CatalogShow) {
  // Prefer poster from first trailer, then from first episode
  const trailerSource = show.trailers[0];
  if (trailerSource?.artwork) return trailerSource.artwork;
  const firstEpisode = show.seasons[0]?.episodes[0];
  if (firstEpisode?.artwork) return firstEpisode.artwork;
  return undefined;
}

export function ShowCard({ show }: ShowCardProps) {
  const showArtwork = getShowArtwork(show);
  const posterUrl = pickPosterArtwork(showArtwork);
  return (
    <Link to={'/shows/' + encodeURIComponent(show.slug)} className="show-card" data-testid="show-card">
      <div className="show-card-poster">
        <ImageWithFallback
          src={posterUrl}
          alt={show.title + ' poster'}
          className="show-card-poster-image"
          imgClassName="show-card-poster-img"
        />
      </div>
      <div className="show-card-info">
        <h3 className="show-card-title" data-testid="show-card-title">{show.title}</h3>
        <p className="show-card-meta" data-testid="show-meta">{show.categories.join(', ')}</p>
      </div>
    </Link>
  );
}
