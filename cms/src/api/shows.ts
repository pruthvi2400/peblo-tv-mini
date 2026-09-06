/**
 * Shows API surface (Phase 7B).
 *
 * Mirrors `backend/app/api/shows.py`. Every call goes through the
 * centralised `apiFetch` so token + error handling stay consistent.
 */
import { apiFetch } from './client';
import type {
  Paginated,
  Show,
  ShowCreateInput,
  ShowSection,
  ShowStatus,
  ShowUpdateInput,
} from '../types/api';

export interface ListShowsParams {
  search?: string;
  /** Filter by show status enum. */
  status?: ShowStatus;
  /** Filter by platform section. */
  section?: ShowSection;
  page?: number;
  page_size?: number;
}

/** GET /api/shows — paginated list of shows. */
export function listShows(
  params: ListShowsParams = {},
): Promise<Paginated<Show>> {
  return apiFetch<Paginated<Show>>('/api/shows', {
    query: {
      search: params.search,
      status: params.status,
      section: params.section,
      page: params.page,
      page_size: params.page_size,
    },
  });
}

/** GET /api/shows/{id} — fetch a single show. */
export function getShow(showId: number): Promise<Show> {
  return apiFetch<Show>(`/api/shows/${showId}`);
}

/** POST /api/shows — create a new show. */
export function createShow(payload: ShowCreateInput): Promise<Show> {
  return apiFetch<Show>('/api/shows', {
    method: 'POST',
    body: payload,
  });
}

/** PUT /api/shows/{id} — partial update. */
export function updateShow(
  showId: number,
  payload: ShowUpdateInput,
): Promise<Show> {
  return apiFetch<Show>(`/api/shows/${showId}`, {
    method: 'PUT',
    body: payload,
  });
}

/** DELETE /api/shows/{id} — delete a show. */
export function deleteShow(showId: number): Promise<void> {
  return apiFetch<void>(`/api/shows/${showId}`, {
    method: 'DELETE',
  });
}