/**
 * SeasonBlock — shows a single season on the ShowDetailPage along with
 * its episodes (with filters), plus the per-season action buttons.
 */
import { useMemo, useState } from 'react';

import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { SelectInput } from '../../components/forms/SelectInput';
import { TextInput } from '../../components/forms/TextInput';
import { useDeleteSeason } from '../../hooks/useSeasons';
import { useDeleteEpisode, useEpisodes } from '../../hooks/useEpisodes';
import {
  EPISODE_STATUSES,
  LANGUAGES,
  type Episode,
  type EpisodeStatus,
  type Language,
  type Season,
} from '../../types/api';
import { EpisodeArtworkDialog } from './EpisodeArtworkDialog';
import { EpisodeFormDialog } from './EpisodeFormDialog';

interface Props {
  season: Season;
  onEditSeason: (season: Season) => void;
}

export function SeasonBlock({ season, onEditSeason }: Props) {
  const [statusFilter, setStatusFilter] = useState<EpisodeStatus | ''>('');
  const [languageFilter, setLanguageFilter] = useState<Language | ''>('');
  const [titleFilter, setTitleFilter] = useState('');

  const episodesQuery = useEpisodes({
    season_id: season.id,
    status: statusFilter || undefined,
    language: languageFilter || undefined,
  });

  const deleteSeasonMutation = useDeleteSeason(season.id);

  const [episodeDialog, setEpisodeDialog] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; episode: Episode }
    | null
  >(null);
  const [artworkEpisode, setArtworkEpisode] = useState<Episode | null>(null);
  const [pendingEpisodeDelete, setPendingEpisodeDelete] = useState<number | null>(null);
  const [pendingSeasonDelete, setPendingSeasonDelete] = useState(false);

  const deleteEpisodeMutation = useDeleteEpisode(season.id);

  const filteredEpisodes = useMemo(() => {
    const items = episodesQuery.data?.items ?? [];
    if (!titleFilter.trim()) return items;
    const needle = titleFilter.toLowerCase();
    return items.filter((e) => e.title.toLowerCase().includes(needle));
  }, [episodesQuery.data?.items, titleFilter]);

  return (
    <>
      <section className="season-block" data-testid={`season-block-${season.id}`}>
        <header className="section-heading">
          <h2>
            Season {season.season_number}
            {season.season_number === 0 && (
              <span className="tag">trailers</span>
            )}
          </h2>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setEpisodeDialog({ mode: 'create' })}
              data-testid={`new-episode-${season.id}`}
            >
              + Episode
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onEditSeason(season)}
              data-testid={`edit-season-${season.id}`}
            >
              Edit season
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => setPendingSeasonDelete(true)}
              data-testid={`delete-season-${season.id}`}
            >
              Delete season
            </button>
          </div>
        </header>

        <div className="toolbar">
          <div className="toolbar__filters">
            <TextInput
              id={`ep-search-${season.id}`}
              value={titleFilter}
              onChange={setTitleFilter}
              placeholder="Search episodes…"
              maxLength={255}
            />
            <SelectInput<EpisodeStatus>
              id={`ep-status-${season.id}`}
              value={statusFilter}
              onChange={(v) => setStatusFilter((v || '') as EpisodeStatus | '')}
              options={[
                { value: '', label: 'All statuses' },
                ...EPISODE_STATUSES.map((s) => ({ value: s, label: s })),
              ]}
            />
            <SelectInput<Language>
              id={`ep-lang-${season.id}`}
              value={languageFilter}
              onChange={(v) => setLanguageFilter((v || '') as Language | '')}
              options={[
                { value: '', label: 'All languages' },
                ...LANGUAGES.map((l) => ({ value: l, label: l })),
              ]}
            />
          </div>
        </div>

        {episodesQuery.isLoading ? (
          <LoadingState label="Loading episodes…" />
        ) : episodesQuery.error ? (
          <ErrorState
            message={episodesQuery.error.message}
            onRetry={() => episodesQuery.refetch()}
          />
        ) : filteredEpisodes.length === 0 ? (
          <EmptyState
            title="No episodes"
            description="Add the first episode for this season."
          />
        ) : (
          <div className="episode-list" data-testid={`episodes-list-${season.id}`}>
            {filteredEpisodes.map((episode) => (
              <div
                key={episode.id}
                className="episode-row"
                data-testid={`episode-row-${episode.id}`}
              >
                <span className="episode-row__num">{episode.episode_number}</span>
                <div style={{ flex: 1 }}>
                  <div className="episode-row__title">{episode.title}</div>
                  <div className="episode-row__meta">
                    {episode.language}
                    {episode.duration ? ` · ${formatDuration(episode.duration)}` : ''}
                    <span className={`tag tag--${episode.status}`} style={{ marginLeft: 6 }}>
                      {episode.status}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setArtworkEpisode(episode)}
                  data-testid={`artwork-episode-${episode.id}`}
                >
                  Artwork
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setEpisodeDialog({ mode: 'edit', episode })}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setPendingEpisodeDelete(episode.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {episodeDialog?.mode === 'create' && (
        <EpisodeFormDialog
          seasonId={season.id}
          episode={null}
          onClose={() => setEpisodeDialog(null)}
          onSaved={() => undefined}
        />
      )}
      {episodeDialog?.mode === 'edit' && (
        <EpisodeFormDialog
          seasonId={episodeDialog.episode.season_id}
          episode={episodeDialog.episode}
          onClose={() => setEpisodeDialog(null)}
          onSaved={() => undefined}
        />
      )}

      {artworkEpisode && (
        <EpisodeArtworkDialog
          episode={artworkEpisode}
          onClose={() => setArtworkEpisode(null)}
        />
      )}

      {pendingEpisodeDelete !== null && (
        <ConfirmDialog
          title="Delete episode?"
          message="This will permanently delete the episode. This action cannot be undone."
          confirmLabel="Delete episode"
          variant="danger"
          isWorking={deleteEpisodeMutation.isPending}
          onClose={() => setPendingEpisodeDelete(null)}
          onConfirm={async () => {
            try {
              await deleteEpisodeMutation.mutateAsync(pendingEpisodeDelete);
              setPendingEpisodeDelete(null);
            } catch {
              /* leave dialog open */
            }
          }}
        />
      )}

      {pendingSeasonDelete && (
        <ConfirmDialog
          title="Delete season?"
          message="This will permanently delete the season and all of its episodes. This action cannot be undone."
          confirmLabel="Delete season"
          variant="danger"
          isWorking={deleteSeasonMutation.isPending}
          onClose={() => setPendingSeasonDelete(false)}
          onConfirm={async () => {
            try {
              await deleteSeasonMutation.mutateAsync(season.id);
              setPendingSeasonDelete(false);
            } catch {
              /* leave dialog open */
            }
          }}
        />
      )}
    </>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
