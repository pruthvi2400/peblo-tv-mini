/**
 * Episodes API surface (Phase 7B).
 */
import { apiFetch } from './client';
import type {
  Episode,
  EpisodeCreateInput,
  EpisodeStatus,
  Language,
  Paginated,
} from '../types/api';

export interface ListEpisodesParams {
  season_id?: number;
  show_id?: number;
  status?: EpisodeStatus;
  language?: Language;
  /** Case-insensitive substring on episode title. */
  search?: string;
  page?: number;
  page_size?: number;
}

/** GET /api/episodes — paginated list of episodes. */
export function listEpisodes(
  params: ListEpisodesParams = {},
): Promise<Paginated<Episode>> {
  return apiFetch<Paginated<Episode>>('/api/episodes', {
    query: {
      season_id: params.season_id,
      show_id: params.show_id,
      status: params.status,
      language: params.language,
      // The backend does not currently support a title search on this
      // endpoint, but the type carries it for forward-compat.
      search: params.search,
      page: params.page,
      page_size: params.page_size,
    },
  });
}

/** GET /api/episodes/{id} — fetch a single episode. */
export function getEpisode(episodeId: number): Promise<Episode> {
  return apiFetch<Episode>(`/api/episodes/${episodeId}`);
}

/**
 * POST /api/episodes — create a new episode.
 *
 * The `artwork` field is omitted from the Phase 7B UI; the backend
 * schema defaults it to [].
 */
export function createEpisode(
  payload: EpisodeCreateInput,
): Promise<Episode> {
  return apiFetch<Episode>('/api/episodes', {
    method: 'POST',
    body: { ...payload, artwork: [] },
  });
}

/** PUT /api/episodes/{id} — partial update. */
export function updateEpisode(
  episodeId: number,
  payload: import('../types/api').EpisodeUpdateInput,
): Promise<Episode> {
  return apiFetch<Episode>(`/api/episodes/${episodeId}`, {
    method: 'PUT',
    body: payload,
  });
}

/** DELETE /api/episodes/{id} — delete an episode. */
export function deleteEpisode(episodeId: number): Promise<void> {
  return apiFetch<void>(`/api/episodes/${episodeId}`, {
    method: 'DELETE',
  });
}