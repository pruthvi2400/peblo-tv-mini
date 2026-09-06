/**
 * Episode hooks (Phase 7B).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import {
  createEpisode,
  deleteEpisode,
  listEpisodes,
  updateEpisode,
  type ListEpisodesParams,
} from '../api/episodes';
import type {
  Episode,
  EpisodeCreateInput,
  EpisodeUpdateInput,
} from '../types/api';
import { queryKeys } from './queryKeys';

export function useEpisodes(
  params: ListEpisodesParams = {},
): UseQueryResult<Awaited<ReturnType<typeof listEpisodes>>, Error> {
  return useQuery({
    queryKey: queryKeys.episodes.list({ ...params }),
    queryFn: () => listEpisodes(params),
    staleTime: 30_000,
  });
}

export function useCreateEpisode(): UseMutationResult<
  Episode,
  Error,
  EpisodeCreateInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EpisodeCreateInput) => createEpisode(payload),
    onSuccess: (episode) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.episodes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.detail(episode.season_id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
    },
  });
}

export function useUpdateEpisode(
  episodeId: number,
  seasonId: number,
): UseMutationResult<Episode, Error, EpisodeUpdateInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EpisodeUpdateInput) => updateEpisode(episodeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.episodes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.detail(seasonId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
    },
  });
}

export function useDeleteEpisode(
  seasonId: number,
): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEpisode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.episodes.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.seasons.detail(seasonId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.seasons.all });
    },
  });
}