/**
 * useShows / useShow / useCreateShow / useUpdateShow / useDeleteShow.
 *
 * All read hooks are thin wrappers around `useQuery`. All write hooks
 * are `useMutation` that call `queryClient.invalidateQueries` so the
 * list + detail views refresh after a write.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  createShow,
  deleteShow,
  getShow,
  listShows,
  updateShow,
  type ListShowsParams,
} from '../api/shows';
import type {
  Show,
  ShowCreateInput,
  ShowUpdateInput,
} from '../types/api';
import { queryKeys } from './queryKeys';

/** GET /api/shows — paginated list. */
export function useShows(
  params: ListShowsParams = {},
): UseQueryResult<Awaited<ReturnType<typeof listShows>>, Error> {
  return useQuery({
    queryKey: queryKeys.shows.list({ ...params }),
    queryFn: () => listShows(params),
    // Keep list results fresh long enough to feel "live" but not so
    // aggressive that navigation between list pages hits the API every
    // time.
    staleTime: 30_000,
  });
}

/** GET /api/shows/{id} — single show. */
export function useShow(
  showId: number | null | undefined,
): UseQueryResult<Show, Error> {
  return useQuery({
    queryKey:
      showId == null ? ['shows', 'detail', 'none'] : queryKeys.shows.detail(showId),
    queryFn: () => {
      if (showId == null) {
        return Promise.reject(new Error('showId is required'));
      }
      return getShow(showId);
    },
    enabled: showId != null,
    staleTime: 30_000,
  });
}

interface MutationCtx {
  queryClient: ReturnType<typeof useQueryClient>;
}

function invalidateShows(ctx: MutationCtx, showId?: number) {
  ctx.queryClient.invalidateQueries({ queryKey: queryKeys.shows.all });
  if (showId != null) {
    ctx.queryClient.invalidateQueries({
      queryKey: queryKeys.shows.detail(showId),
    });
    // Season/episode queries are keyed off the show's children; refresh
    // them too so the detail tree updates after a parent mutation.
    ctx.queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
    ctx.queryClient.invalidateQueries({ queryKey: queryKeys.episodes.all });
  }
}

/** POST /api/shows — create a show. */
export function useCreateShow(): UseMutationResult<
  Show,
  Error,
  ShowCreateInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShowCreateInput) => createShow(payload),
    onSuccess: () => {
      invalidateShows({ queryClient });
    },
  });
}

/** PUT /api/shows/{id} — partial update. */
export function useUpdateShow(
  showId: number,
): UseMutationResult<Show, Error, ShowUpdateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShowUpdateInput) => updateShow(showId, payload),
    onSuccess: () => {
      invalidateShows({ queryClient }, showId);
    },
  });
}

/** DELETE /api/shows/{id} — delete a show. */
export function useDeleteShow(): UseMutationResult<
  void,
  Error,
  number
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteShow(id),
    onSuccess: (_void, id) => {
      invalidateShows({ queryClient }, id);
    },
  });
}