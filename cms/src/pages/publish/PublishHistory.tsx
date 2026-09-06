/**
 * PublishHistory — shows the list of past publish runs (Phase 7C).
 */
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PermissionDenied } from '../../components/PermissionDenied';
import { PermissionDeniedError } from '../../api/client';
import { usePublishRuns } from '../../hooks/usePublish';
import type { PublishRun } from '../../types/api';
import './PublishHistory.css';

const PAGE_SIZE = 20;

export function PublishHistory() {
  const query = usePublishRuns({ page: 1, page_size: PAGE_SIZE });

  if (query.error) {
    if (query.error instanceof PermissionDeniedError) {
      return (
        <PermissionDenied
          title="Cannot load publish history"
          message="You do not have permission to view publish history."
        />
      );
    }
    return (
      <ErrorState
        title="Could not load publish history"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  if (query.isLoading) {
    return <LoadingState label="Loading publish history…" />;
  }

  const runs = query.data ?? [];

  return (
    <div className="publish-history" data-testid="publish-history">
      <h3 className="publish-history__title">Publish history</h3>
      {runs.length === 0 ? (
        <p className="publish-history__empty">No publish runs yet.</p>
      ) : (
        <table className="table publish-history__table" data-testid="publish-runs-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Shows</th>
              <th>Seasons</th>
              <th>Episodes</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <PublishRunRow key={run.id} run={run} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface RowProps {
  run: PublishRun;
}

function PublishRunRow({ run }: RowProps) {
  const started = formatDateTime(run.started_at);
  const duration = run.completed_at
    ? formatDuration(new Date(run.started_at), new Date(run.completed_at))
    : '—';

  const statusClass = {
    completed: 'status--ok',
    failed: 'status--fail',
    pending: 'status--pending',
    running: 'status--running',
    cancelled: 'status--cancelled',
  }[run.status] ?? '';

  const resultDetail = run.status === 'completed'
    ? `${run.shows_count ?? 0} shows · ${run.episodes_count ?? 0} episodes`
    : run.error_message
      ? run.error_message
      : '—';

  return (
    <tr data-testid={`publish-run-${run.id}`}>
      <td><code>#{run.id}</code></td>
      <td>
        <span className={`tag ${statusClass}`}>{run.status}</span>
      </td>
      <td>{started}</td>
      <td>{duration}</td>
      <td>{run.shows_count ?? '—'}</td>
      <td>{run.seasons_count ?? '—'}</td>
      <td>{run.episodes_count ?? '—'}</td>
      <td className="publish-history__result">{resultDetail}</td>
    </tr>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return '—';
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ${diffMin % 60}m`;
}
