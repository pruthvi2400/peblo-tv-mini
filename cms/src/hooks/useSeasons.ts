/**
 * Season hooks (Phase 7B).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  createSeason,
  deleteSeason,
  listSeasons,
  updateSeason,
  type ListSeasonsParams,
} from '../api/seasons';
import type {
  Season,
  SeasonCreateInput,
  SeasonUpdateInput,
} from '../types/api';
import { queryKeys } from './queryKeys';

export function useSeasons(
  params: ListSeasonsParams = {},
): UseQueryResult<Awaited<ReturnType<typeof listSeasons>>, Error> {
  return useQuery({
    queryKey: queryKeys.seasons.list({ ...params }),
    queryFn: () => listSeasons(params),
    staleTime: 30_000,
  });
}

export function useCreateSeason(): UseMutationResult<
  Season,
  Error,
  SeasonCreateInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SeasonCreateInput) => createSeason(payload),
    onSuccess: (season) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shows.detail(season.show_id),
      });
    },
  });
}

export function useUpdateSeason(
  seasonId: number,
  showId: number,
): UseMutationResult<Season, Error, SeasonUpdateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SeasonUpdateInput) => updateSeason(seasonId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.detail(showId) });
    },
  });
}

export function useDeleteSeason(
  showId: number,
): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSeason(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.episodes.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.shows.detail(showId) });
      void id;
    },
  });
}