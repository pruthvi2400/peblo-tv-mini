/**
 * ValidationReport — display the /admin/validation-report response in
 * an editor-friendly grouped list.
 */
import { useMemo } from 'react';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { LoadingState } from '../../components/LoadingState';
import { PermissionDenied } from '../../components/PermissionDenied';
import { PermissionDeniedError } from '../../api/client';
import { useValidationReport } from '../../hooks/usePublish';
import type { ValidationIssue } from '../../types/api';
import './ValidationReport.css';

export function ValidationReport() {
  const query = useValidationReport();

  if (query.error) {
    if (query.error instanceof PermissionDeniedError) {
      return (
        <PermissionDenied
          title="Cannot load validation report"
          message="You do not have permission to view the validation report."
        />
      );
    }
    return (
      <ErrorState
        title="Could not load validation report"
        message={query.error.message}
        onRetry={() => query.refetch()}
      />
    );
  }

  if (query.isLoading) {
    return <LoadingState label="Loading validation report…" />;
  }

  const report = query.data;
  if (!report) {
    return <EmptyState title="No validation data" />;
  }

  return <ValidationReportBody report={report} />;
}

interface BodyProps {
  report: {
    can_publish: boolean;
    issues: ValidationIssue[];
    summary: {
      blocking_issues: number;
      by_type: Record<string, number>;
      shows_scanned: number;
      episodes_scanned: number;
    };
  };
}

function ValidationReportBody({ report }: BodyProps) {
  const { can_publish, issues, summary } = report;

  // Group issues by type for editor-friendly display.
  const grouped = useMemo(() => {
    const out = new Map<string, ValidationIssue[]>();
    for (const issue of issues) {
      const arr = out.get(issue.type) ?? [];
      arr.push(issue);
      out.set(issue.type, arr);
    }
    return Array.from(out.entries())
      .map(([type, items]) => ({ type, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [issues]);

  return (
    <div
      className={`validation-report${can_publish ? ' is-publishable' : ' is-blocked'}`}
      data-testid="validation-report"
    >
      <div
        className={`validation-report__banner${can_publish ? ' validation-report__banner--ok' : ' validation-report__banner--block'}`}
        role="status"
        data-testid="validation-banner"
        data-can-publish={can_publish ? 'true' : 'false'}
      >
        {can_publish ? (
          <>
            <strong>No blocking issues.</strong>
            <span>
              {' '}The catalogue is ready to publish. {summary.shows_scanned} show
              {summary.shows_scanned === 1 ? '' : 's'} and{' '}
              {summary.episodes_scanned} episode
              {summary.episodes_scanned === 1 ? '' : 's'} scanned.
            </span>
          </>
        ) : (
          <>
            <strong>
              Publish blocked by {summary.blocking_issues} issue
              {summary.blocking_issues === 1 ? '' : 's'}.
            </strong>
            <span>
              {' '}Fix the issue
              {summary.blocking_issues === 1 ? '' : 's'} below before publishing.
            </span>
          </>
        )}
      </div>

      <div className="validation-report__meta">
        Scanned {summary.shows_scanned} show
        {summary.shows_scanned === 1 ? '' : 's'} ·{' '}
        {summary.episodes_scanned} episode
        {summary.episodes_scanned === 1 ? '' : 's'}
      </div>

      {grouped.length === 0 ? (
        <p className="validation-report__none">No issues found.</p>
      ) : (
        <ul
          className="validation-report__groups"
          data-testid="validation-groups"
        >
          {grouped.map((g) => (
            <li
              key={g.type}
              className="validation-report__group"
              data-testid={`validation-group-${g.type}`}
            >
              <header className="validation-report__group-head">
                <span className="validation-report__group-code">{g.type}</span>
                <span className="validation-report__group-count">
                  {g.items.length}
                </span>
              </header>
              <ul className="validation-report__group-items">
                {g.items.map((issue, idx) => (
                  <li
                    key={`${issue.entity}-${issue.entity_id}-${idx}`}
                    className="validation-report__item"
                    data-testid={`validation-item-${issue.type}-${issue.entity_id}`}
                  >
                    <span
                      className={`validation-report__entity validation-report__entity--${issue.entity}`}
                    >
                      {issue.entity}
                    </span>
                    <span className="validation-report__title">
                      {issue.title}
                    </span>
                    <span className="validation-report__message">
                      {issue.message}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


