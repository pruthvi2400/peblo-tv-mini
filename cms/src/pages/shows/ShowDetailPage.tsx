/**
 * ShowDetailPage — single show view + nested seasons + episodes.
 *
 * Loads:
 *   GET /api/shows/{id}      for the show itself
 *   GET /api/seasons?show_id for its seasons
 *
 * Episodes are loaded per-season inside <SeasonBlock />.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PermissionDenied } from '../../components/PermissionDenied';
import {
  NotFoundError,
  PermissionDeniedError,
} from '../../api/client';
import { useDeleteShow, useShow } from '../../hooks/useShows';
import { useSeasons } from '../../hooks/useSeasons';
import { SeasonFormDialog } from './SeasonFormDialog';
import { SeasonBlock } from './SeasonBlock';
import type { Season } from '../../types/api';

export function ShowDetailPage() {
  const { showId: rawShowId } = useParams<{ showId: string }>();
  const showId = Number(rawShowId);
  const navigate = useNavigate();

  const showQuery = useShow(Number.isFinite(showId) ? showId : null);
  const seasonsQuery = useSeasons({
    show_id: Number.isFinite(showId) ? showId : undefined,
  });
  const deleteShowMutation = useDeleteShow();

  const [seasonDialog, setSeasonDialog] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; season: Season }
    | null
  >(null);
  const [pendingShowDelete, setPendingShowDelete] = useState(false);

  if (!Number.isFinite(showId)) {
    return (
      <ErrorState
        title="Invalid show id"
        message="The URL does not contain a numeric show id."
      />
    );
  }

  if (showQuery.isLoading) {
    return <LoadingState label="Loading show…" />;
  }
  if (showQuery.error) {
    if (showQuery.error instanceof NotFoundError) {
      return (
        <ErrorState
          title="Show not found"
          message="The show you were looking for no longer exists."
        >
          <Link to="/app/shows" className="btn btn--primary">
            Back to Shows
          </Link>
        </ErrorState>
      );
    }
    if (showQuery.error instanceof PermissionDeniedError) {
      return (
        <PermissionDenied
          title="Permission denied"
          message="You do not have permission to view this show."
        />
      );
    }
    return (
      <ErrorState
        message={showQuery.error.message}
        onRetry={() => showQuery.refetch()}
      />
    );
  }

  const show = showQuery.data;
  if (!show) return null;

  const seasons = seasonsQuery.data?.items ?? [];
  const sortedSeasons = [...seasons].sort(
    (a, b) => a.season_number - b.season_number,
  );

  return (
    <section data-testid="show-detail-page">
      <nav className="breadcrumbs">
        <Link to="/app/shows">Shows</Link>
        <span>/</span>
        <span>{show.title}</span>
      </nav>
      <header className="page-header" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1>{show.title}</h1>
          <p>
            <span className={`tag tag--${show.status}`}>{show.status}</span>
            <span className="tag">{show.section}</span>
            <code style={{ marginLeft: 6 }}>{show.slug}</code>
          </p>
        </div>
        <div className="row-actions">
          <Link to={`/app/shows/${show.id}/edit`} className="btn btn--ghost">
            Edit show
          </Link>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => setPendingShowDelete(true)}
            data-testid="delete-show"
          >
            Delete show
          </button>
        </div>
      </header>

      <dl className="detail-grid" data-testid="show-meta">
        <dt>Slug</dt>
        <dd>
          <code>{show.slug}</code>
        </dd>
        <dt>Section</dt>
        <dd>{show.section}</dd>
        <dt>Status</dt>
        <dd>{show.status}</dd>
        <dt>Categories</dt>
        <dd>
          {show.categories.length === 0
            ? '—'
            : show.categories.map((c) => (
                <span key={c} className="tag">
                  {c}
                </span>
              ))}
        </dd>
        <dt>Synopsis</dt>
        <dd>{show.synopsis ?? '—'}</dd>
        <dt>Last updated</dt>
        <dd>{new Date(show.updated_at).toLocaleString()}</dd>
      </dl>

      <div className="section-heading">
        <h2>Seasons</h2>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setSeasonDialog({ mode: 'create' })}
          data-testid="new-season"
        >
          + Season
        </button>
      </div>

      {seasonsQuery.isLoading ? (
        <LoadingState label="Loading seasons…" />
      ) : seasonsQuery.error ? (
        <ErrorState
          message={seasonsQuery.error.message}
          onRetry={() => seasonsQuery.refetch()}
        />
      ) : sortedSeasons.length === 0 ? (
        <EmptyState
          title="No seasons yet"
          description="Create the first season for this show."
        />
      ) : (
        <div data-testid="seasons-list">
          {sortedSeasons.map((season) => (
            <SeasonBlock
              key={season.id}
              season={season}
              onEditSeason={(s) => setSeasonDialog({ mode: 'edit', season: s })}
            />
          ))}
        </div>
      )}

      {seasonDialog?.mode === 'create' && (
        <SeasonFormDialog
          showId={show.id}
          season={null}
          onClose={() => setSeasonDialog(null)}
          onSaved={() => undefined}
        />
      )}
      {seasonDialog?.mode === 'edit' && (
        <SeasonFormDialog
          showId={show.id}
          season={seasonDialog.season}
          onClose={() => setSeasonDialog(null)}
          onSaved={() => undefined}
        />
      )}

      {pendingShowDelete && (
        <ConfirmDialog
          title="Delete show?"
          message="This will permanently delete the show and all of its seasons and episodes. This action cannot be undone."
          confirmLabel="Delete show"
          variant="danger"
          isWorking={deleteShowMutation.isPending}
          onClose={() => setPendingShowDelete(false)}
          onConfirm={async () => {
            try {
              await deleteShowMutation.mutateAsync(show.id);
              navigate('/app/shows');
            } catch {
              /* leave dialog open */
            }
          }}
        />
      )}
    </section>
  );
}