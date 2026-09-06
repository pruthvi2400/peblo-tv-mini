/**
 * Seasons API surface (Phase 7B).
 */
import { apiFetch } from './client';
import type {
  Paginated,
  Season,
  SeasonCreateInput,
  SeasonUpdateInput,
} from '../types/api';

export interface ListSeasonsParams {
  show_id?: number;
  page?: number;
  page_size?: number;
}

/** GET /api/seasons — paginated list of seasons. */
export function listSeasons(
  params: ListSeasonsParams = {},
): Promise<Paginated<Season>> {
  return apiFetch<Paginated<Season>>('/api/seasons', {
    query: {
      show_id: params.show_id,
      page: params.page,
      page_size: params.page_size,
    },
  });
}

/** GET /api/seasons/{id} — fetch a single season. */
export function getSeason(seasonId: number): Promise<Season> {
  return apiFetch<Season>(`/api/seasons/${seasonId}`);
}

/** POST /api/seasons — create a new season for a show. */
export function createSeason(payload: SeasonCreateInput): Promise<Season> {
  return apiFetch<Season>('/api/seasons', {
    method: 'POST',
    body: payload,
  });
}

/** PUT /api/seasons/{id} — partial update (only season_number is mutable). */
export function updateSeason(
  seasonId: number,
  payload: SeasonUpdateInput,
): Promise<Season> {
  return apiFetch<Season>(`/api/seasons/${seasonId}`, {
    method: 'PUT',
    body: payload,
  });
}

/** DELETE /api/seasons/{id} — delete a season (cascades to episodes). */
export function deleteSeason(seasonId: number): Promise<void> {
  return apiFetch<void>(`/api/seasons/${seasonId}`, {
    method: 'DELETE',
  });
}