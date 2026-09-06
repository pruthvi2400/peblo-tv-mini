/**
 * Artwork hooks (Phase 7C).
 */
import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import {
  deleteEpisodeArtwork,
  uploadEpisodeArtwork,
  type UploadArtworkParams,
} from "../api/artwork";
import type { Artwork } from "../types/api";
import { queryKeys } from "./queryKeys";

/** Upload artwork for an episode. */
export function useUploadArtwork(): UseMutationResult<
  Artwork,
  Error,
  UploadArtworkParams
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) => uploadEpisodeArtwork(params),
    onSuccess: (artwork) => {
      // Artwork lives on the episode; invalidate episode queries.
      queryClient.invalidateQueries({
        queryKey: queryKeys.artwork.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.episodes.all,
      });
      void artwork;
    },
  });
}

/** Delete artwork from an episode. */
export function useDeleteArtwork(): UseMutationResult<
  void,
  Error,
  { episode_id: number; artwork_type: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episode_id, artwork_type }) =>
      deleteEpisodeArtwork(episode_id, artwork_type),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.artwork.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.episodes.all,
      });
    },
  });
}
