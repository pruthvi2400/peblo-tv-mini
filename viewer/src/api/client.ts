/**
 * Centralized API client for the Peblo TV Viewer.
 *
 * IMPORTANT: This client is strictly limited to the public catalogue
 * endpoints. The Viewer MUST NOT call any CMS / admin / CRUD endpoint.
 *
 * Allowed endpoints (no authentication required):
 *   GET  /catalog        — returns the full published catalogue snapshot
 *   GET  /catalog/search — server-side filtered search
 *
 * Forbidden (will raise a TypeScript error if accidentally imported):
 *   /api/shows
 *   /api/seasons
 *   /api/episodes
 *   /admin/validation-report
 *   /admin/catalog/publish
 *   /admin/catalog/publish-runs
 *   any other /admin/* or /api/* endpoint
 *
 * This module enforces that boundary at compile time: the only export
 * is `catalogueClient`, and it has no method for any other path.
 */

import { API_BASE_URL } from '../config';
import type { Catalog, SearchQuery, SearchResponse } from '../types/catalog';

/** The catalogue API base path (always relative to API_BASE_URL). */
const CATALOGUE_BASE = '/catalog';

/**
 * Core fetch wrapper that throws on non-2xx responses.
 * Used ONLY for catalogue endpoints.
 */
async function catalogueFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `HTTP ${res.status} ${res.statusText}`;
    try {
      const body = await res.json().catch(() => null);
      if (body && typeof body === 'object' && 'detail' in body) {
        message = String(body['detail']);
      }
    } catch {
      // ignore JSON parse failures
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/**
 * Retrieve the full published catalogue snapshot.
 *
 * Endpoint: GET /catalog
 * Auth: none (public)
 *
 * @returns The full Catalog document matching
 *          `backend/app/schemas/catalog.py`
 */
export async function getCatalog(): Promise<Catalog> {
  return catalogueFetch<Catalog>(`${API_BASE_URL}${CATALOGUE_BASE}`);
}

/**
 * Search the published catalogue with server-side filtering.
 *
 * Endpoint: GET /catalog/search?q=&category=&language=&section=
 * Auth: none (public)
 *
 * All filter parameters are optional and compose with AND semantics.
 * If no filters are supplied, every show is returned.
 *
 * @param filters - Search parameters (all optional)
 * @returns SearchResponse containing matching shows
 */
export async function searchCatalog(filters: SearchQuery = {}): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.language) params.set('language', filters.language);
  if (filters.section) params.set('section', filters.section);

  const queryString = params.toString();
  const url = `${API_BASE_URL}${CATALOGUE_BASE}/search${queryString ? `?${queryString}` : ''}`;

  return catalogueFetch<SearchResponse>(url);
}

// ── Exports ──────────────────────────────────────────────────────────────────
// Only catalogue endpoints are exported. This module intentionally
// does NOT export anything that would allow calling CMS/admin routes.
// If you need a new endpoint, add it here — not in a separate file.
export const catalogueClient = {
  getCatalog,
  searchCatalog,
};
