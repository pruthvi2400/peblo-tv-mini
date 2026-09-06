// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import type { CatalogEpisode, CatalogSeason } from '../types/catalog';
import { ImageWithFallback } from './ImageWithFallback';
import { pickThumbnailArtwork } from './artwork';

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + (s > 0 ? s + 's' : '');
  return s + 's';
}

interface EpisodeRowProps {
  episode: CatalogEpisode;
  showNumber?: boolean;
  index?: number;
}

export function EpisodeRow({ episode, showNumber, index = 0 }: EpisodeRowProps) {
  const thumb = pickThumbnailArtwork(episode.artwork);
  return (
    <div className="episode-row" data-testid="episode-row">
      {showNumber && <span className="episode-number">{index + 1}</span>}
      <div className="episode-thumb">
        <ImageWithFallback src={thumb} alt={episode.title + ' thumbnail'} className="episode-thumb-wrap" imgClassName="episode-thumb-img" />
      </div>
      <div className="episode-info">
        <h4 className="episode-title" data-testid="episode-title">{episode.title}</h4>
        <div className="episode-meta">
          {episode.duration != null && episode.duration > 0 && <span className="episode-duration">{formatDuration(episode.duration)}</span>}
          {episode.languages.length > 1 && <span className="episode-languages" data-testid="episode-languages">{episode.languages.join(' | ')}</span>}
          {episode.languages.length === 1 && <span className="episode-language">{episode.languages[0]}</span>}
        </div>
      </div>
    </div>
  );
}

interface SeasonListProps { season: CatalogSeason; }
export function SeasonList({ season }: SeasonListProps) {
  return (
    <div className="season-block" data-testid="season-block">
      <h3 className="season-title" data-testid="season-title">Season {season.season_number}</h3>
      <div className="episode-list">
        {season.episodes.map((ep, i) => <EpisodeRow key={ep.content_group + '-' + ep.canonical_language} episode={ep} showNumber index={i} />)}
      </div>
    </div>
  );
}

interface TrailerListProps { trailers: CatalogEpisode[]; }
export function TrailerList({ trailers }: TrailerListProps) {
  if (!trailers || trailers.length === 0) return null;
  return (
    <div className="trailer-section" data-testid="trailer-section">
      <h3 className="trailer-title" data-testid="trailer-title">Trailers</h3>
      <div className="episode-list">
        {trailers.map((tr, i) => <EpisodeRow key={tr.content_group + '-' + tr.canonical_language} episode={tr} showNumber index={i} />)}
      </div>
    </div>
  );
}
