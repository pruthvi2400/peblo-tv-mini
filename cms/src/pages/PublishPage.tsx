/**
 * PublishPage — Phase 7C.
 *
 * Renders the validation report, a role-gated publish button, and the
 * publish history table. Editors see everything except the Publish
 * button (which is admin-only).
 */
import { useState } from 'react';

import { ErrorState } from '../components/ErrorState';
import { ConfirmDialog } from '../components/dialogs/ConfirmDialog';
import { PermissionDenied } from '../components/PermissionDenied';
import { useAuth } from '../auth/useAuth';
import {
  ApiError,
  PermissionDeniedError,
} from '../api/client';
import { usePublishCatalog, useValidationReport } from '../hooks/usePublish';
import { PublishHistory } from './publish/PublishHistory';
import { ValidationReport } from './publish/ValidationReport';
import './PublishPage.css';

export function PublishPage() {
  const { isAdmin } = useAuth();
  const reportQuery = useValidationReport();
  const publishMutation = usePublishCatalog();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    kind: 'ok' | 'fail';
    message: string;
  } | null>(null);

  if (reportQuery.error) {
    if (reportQuery.error instanceof PermissionDeniedError) {
      return (
        <PermissionDenied
          title="Cannot load publish page"
          message="You do not have permission to view publish information."
        />
      );
    }
    return (
      <ErrorState
        title="Something went wrong"
        message={reportQuery.error.message}
        onRetry={() => reportQuery.refetch()}
      />
    );
  }

  const report = reportQuery.data;
  const canPublish = report?.can_publish ?? false;

  const handlePublish = async () => {
    setPublishResult(null);
    try {
      const res = await publishMutation.mutateAsync();
      if (res.status === 'completed') {
        setPublishResult({
          kind: 'ok',
          message: `Publish #${res.run_id} completed: ${res.shows_count} show${res.shows_count === 1 ? '' : 's'}, ${res.episodes_count} episode${res.episodes_count === 1 ? '' : 's'}.`,
        });
      } else {
        setPublishResult({
          kind: 'fail',
          message: res.error_message ?? 'Publish did not complete.',
        });
      }
    } catch (err) {
      if (err instanceof PermissionDeniedError) {
        setPublishResult({
          kind: 'fail',
          message: 'You do not have permission to publish.',
        });
      } else if (err instanceof ApiError) {
        setPublishResult({
          kind: 'fail',
          message: err.message,
        });
      } else {
        setPublishResult({
          kind: 'fail',
          message: 'Publish failed. Please try again.',
        });
      }
    } finally {
      setConfirmOpen(false);
    }
  };

  return (
    <section data-testid="publish-page">
      <header className="page-header">
        <h1>Publish</h1>
        <p>Run the validation report and publish the live catalogue.</p>
      </header>

      <div className="publish-page__actions" data-testid="publish-actions">
        {isAdmin ? (
          <button
            type="button"
            className="btn btn--primary"
            disabled={!canPublish || publishMutation.isPending}
            onClick={() => setConfirmOpen(true)}
            data-testid="publish-button"
            title={
              !canPublish
                ? 'Fix blocking issues before publishing'
                : 'Run the publish pipeline'
            }
          >
            {publishMutation.isPending ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <p className="publish-page__editor-note" data-testid="publish-editor-note">
            Only admins can publish. You can view the validation report and
            publish history.
          </p>
        )}
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => reportQuery.refetch()}
          disabled={reportQuery.isFetching}
          data-testid="publish-refresh"
        >
          {reportQuery.isFetching ? 'Refreshing…' : 'Refresh report'}
        </button>
      </div>

      {publishResult && (
        <div
          className={`publish-page__result publish-page__result--${publishResult.kind}`}
          role={publishResult.kind === 'fail' ? 'alert' : 'status'}
          data-testid="publish-result"
          data-result-kind={publishResult.kind}
        >
          {publishResult.message}
        </div>
      )}

      <ValidationReport />
      <PublishHistory />

      {confirmOpen && (
        <ConfirmDialog
          title="Run publish pipeline?"
          message="This will run the validation report, build the catalogue, and freeze the live manifest. Continue?"
          confirmLabel="Publish"
          isWorking={publishMutation.isPending}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handlePublish}
          testId="publish-confirm"
        />
      )}
    </section>
  );
}

