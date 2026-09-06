/**
 * Shows list page (Phase 7B).
 *
 * - Server-side search, section + status filters, pagination.
 * - Loading / empty / error / 403 states.
 * - Create / Edit / Delete controls wired to mutations.
 *
 * Filters are stored in URL search params so the URL is shareable.
 */
import { Link, useNavigate } from 'react-router-dom';
import { FormEvent, useState } from 'react';

import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PermissionDenied } from '../../components/PermissionDenied';
import { SelectInput } from '../../components/forms/SelectInput';
import { TextInput } from '../../components/forms/TextInput';
import { useDeleteShow, useShows } from '../../hooks/useShows';
import { PermissionDeniedError } from '../../api/client';
import {
  SHOW_SECTIONS,
  SHOW_STATUSES,
  type ShowSection,
  type ShowStatus,
} from '../../types/api';
import { useShowFilters } from './useShowFilters';

export function ShowsListPage() {
  const navigate = useNavigate();
  const { filters, apiParams, update } = useShowFilters();
  const showsQuery = useShows(apiParams);
  const deleteMutation = useDeleteShow();

  const [searchInput, setSearchInput] = useState(filters.search);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const onSubmitFilters = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update({ search: searchInput, page: 1 });
  };

  const onResetFilters = () => {
    setSearchInput('');
    update({ search: '', status: '', section: '', page: 1 });
  };

  if (showsQuery.error) {
    if (showsQuery.error instanceof PermissionDeniedError) {
      return (
        <PermissionDenied
          title="Permission denied"
          message="You do not have permission to view the catalogue."
        />
      );
    }
    return (
      <ErrorState
        message={showsQuery.error.message}
        onRetry={() => showsQuery.refetch()}
      />
    );
  }

  if (showsQuery.isLoading) {
    return <LoadingState label="Loading shows…" />;
  }

  const data = showsQuery.data;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = data?.page ?? filters.page;
  const pageSize = data?.page_size ?? filters.pageSize;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section data-testid="shows-list-page">
      <header className="page-header">
        <h1>Shows</h1>
        <p>Browse and manage the catalogue of shows.</p>
      </header>

      <form className="toolbar" onSubmit={onSubmitFilters}>
        <div className="toolbar__filters">
          <TextInput
            id="show-search"
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search by title…"
            maxLength={255}
          />
          <SelectInput<ShowStatus>
            id="show-status"
            value={filters.status}
            onChange={(v) => update({ status: v as ShowStatus | '', page: 1 })}
            options={[
              { value: '', label: 'All statuses' },
              ...SHOW_STATUSES.map((s) => ({ value: s, label: s })),
            ]}
          />
          <SelectInput<ShowSection>
            id="show-section"
            value={filters.section}
            onChange={(v) => update({ section: v as ShowSection | '', page: 1 })}
            options={[
              { value: '', label: 'All sections' },
              ...SHOW_SECTIONS.map((s) => ({ value: s, label: s })),
            ]}
          />
          <button type="submit" className="btn btn--primary">
            Search
          </button>
          <button type="button" className="btn btn--ghost" onClick={onResetFilters}>
            Reset
          </button>
        </div>
        <div className="toolbar__spacer" />
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="No shows match your filters"
          description="Try clearing the search or filters above, or create a new show."
        >
          <Link to="/app/shows/new" className="btn btn--primary">
            Create the first show
          </Link>
        </EmptyState>
      ) : (
        <>
          <table className="table" data-testid="shows-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Section</th>
                <th>Status</th>
                <th>Categories</th>
                <th>Slug</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((show) => (
                <tr key={show.id} data-testid={`show-row-${show.id}`}>
                  <td>
                    <Link to={`/app/shows/${show.id}`}>{show.title}</Link>
                  </td>
                  <td>{show.section}</td>
                  <td>
                    <span className={`tag tag--${show.status}`}>
                      {show.status}
                    </span>
                  </td>
                  <td>
                    {show.categories.length === 0
                      ? '—'
                      : show.categories.map((c) => (
                          <span key={c} className="tag">
                            {c}
                          </span>
                        ))}
                  </td>
                  <td>
                    <code>{show.slug}</code>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link
                        to={`/app/shows/${show.id}`}
                        className="btn btn--ghost"
                      >
                        View
                      </Link>
                      <Link
                        to={`/app/shows/${show.id}/edit`}
                        className="btn btn--ghost"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn btn--danger"
                        onClick={() => setPendingDeleteId(show.id)}
                        data-testid={`delete-show-${show.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
            >
              ← Previous
            </button>
            <span className="pagination__info">
              Page {page} of {totalPages} ({total} show{total === 1 ? '' : 's'})
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={page >= totalPages}
              onClick={() => update({ page: page + 1 })}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {pendingDeleteId !== null && (
        <ConfirmDialog
          title="Delete show?"
          message="This will permanently delete the show and all of its seasons and episodes. This action cannot be undone."
          confirmLabel="Delete show"
          variant="danger"
          isWorking={deleteMutation.isPending}
          onClose={() => setPendingDeleteId(null)}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(pendingDeleteId);
              setPendingDeleteId(null);
              navigate('/app/shows');
            } catch {
              // Surface inline below; leave the dialog open so the user
              // can retry or cancel.
            }
          }}
        />
      )}

      {deleteMutation.isError && (
        <ErrorState
          title="Could not delete show"
          message={deleteMutation.error.message}
          onRetry={() => deleteMutation.reset()}
        />
      )}
    </section>
  );
}