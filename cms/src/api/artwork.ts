/**
 * Artwork API surface (Phase 7A foundation only).
 *
 * The upload UI ships in Phase 7C; the typed surface is declared so the
 * rest of the app can already reach for it.
 */
import { apiFetch } from './client';
import type { Artwork } from '../types/api';

export interface UploadArtworkParams {
  episode_id: number;
  artwork_type: 'poster' | 'banner' | 'thumbnail';
  file: File;
}

export function deleteEpisodeArtwork(
  episode_id: number,
  artwork_type: string,
): Promise<void> {
  return apiFetch<void>(
    `/api/episodes/${episode_id}/artwork/${artwork_type}`,
    { method: 'DELETE' },
  );
}

export function uploadEpisodeArtwork(
  params: UploadArtworkParams,
): Promise<Artwork> {
  const form = new FormData();
  form.append('artwork_type', params.artwork_type);
  form.append('file', params.file);
  return apiFetch<Artwork>(`/api/episodes/${params.episode_id}/artwork`, {
    method: 'POST',
    formData: form,
  });
}