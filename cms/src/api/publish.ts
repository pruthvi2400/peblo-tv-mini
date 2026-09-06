/**
 * Publish + publish-history API surface (Phase 6 backend).
 */
import { apiFetch } from "./client";
import type { PublishResult, PublishRun, ValidationReport } from "../types/api";

export interface ListPublishRunsParams {
  page?: number;
  page_size?: number;
}

/** Fetch the current validation report. Editor + admin. */
export function getValidationReport(): Promise<ValidationReport> {
  return apiFetch<ValidationReport>("/admin/validation-report");
}

/** Trigger a publish. Admin only on the backend. */
export function publishCatalog(): Promise<PublishResult> {
  return apiFetch<PublishResult>("/admin/catalog/publish", {
    method: "POST",
  });
}

/** Newest-first list of PublishRun history. Editor + admin. */
export function listPublishRuns(
  params: ListPublishRunsParams = {},
): Promise<PublishRun[]> {
  return apiFetch<PublishRun[]>("/admin/catalog/publish-runs", {
    query: {
      page: params.page,
      page_size: params.page_size,
    },
  });
}
