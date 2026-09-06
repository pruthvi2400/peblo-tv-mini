/**
 * Publish hooks (Phase 7C).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import {
  getValidationReport,
  listPublishRuns,
  publishCatalog,
  type ListPublishRunsParams,
} from "../api/publish";
import type { PublishResult, PublishRun, ValidationReport } from "../types/api";
import { queryKeys } from "./queryKeys";

/** Fetch the validation report. Editor + admin. */
export function useValidationReport(): UseQueryResult<
  ValidationReport,
  Error
> {
  return useQuery({
    queryKey: queryKeys.validation.report(),
    queryFn: getValidationReport,
    staleTime: 0,
  });
}

/** Fetch publish history. Editor + admin. */
export function usePublishRuns(
  params: ListPublishRunsParams = {},
): UseQueryResult<PublishRun[], Error> {
  return useQuery({
    queryKey: queryKeys.publish.runs(params as unknown as Record<string, unknown>),
    queryFn: () => listPublishRuns(params),
    staleTime: 0,
  });
}

/** Trigger a catalogue publish. Admin only. */
export function usePublishCatalog(): UseMutationResult<
  PublishResult,
  Error,
  void
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => publishCatalog(),
    onSuccess: () => {
      // Refresh validation report and publish history after a publish.
      queryClient.invalidateQueries({
        queryKey: queryKeys.validation.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.publish.all,
      });
    },
  });
}
