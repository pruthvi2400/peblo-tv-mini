/**
 * TypeScript types for the Peblo TV published catalogue.
 *
 * These mirror the Pydantic schemas in
 * `backend/app/schemas/catalog.py` exactly. The Viewer is a
 * read-only consumer of the published snapshot; it MUST NOT
 * invent additional shape, and it MUST NOT call any
 * admin / CMS endpoint to reconstruct this data.
 *
 * Source of truth (backend):
 *   - GET /catalog          -> Catalog
 *   - GET /catalog/search   -> SearchResponse
 *
 * The catalogue document is built by the backend publisher from
 * the live database, frozen onto object storage, and returned as a
 * single JSON blob. The Viewer therefore works with the entire
 * catalogue (so it can render Netflix-style section rows locally)
 * AND has a dedicated search endpoint that runs server-side
 * filtering (so search never pulls the full doc just to filter
 * client-side — except the home page, which needs everything to
 * render its section rows).
 */

export interface ArtworkItem {
  type: string;
  url: string;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
}

export type ArtworkMap = Record<string, ArtworkItem>;

export interface CatalogEpisode {
  content_group: string;
  languages: string[];
  canonical_language: string;
  title: string;
  episode_number: number;
  duration?: number | null;
  artwork: ArtworkMap;
}

export interface CatalogTrailer extends CatalogEpisode {}

export interface CatalogSeason {
  season_number: number;
  episodes: CatalogEpisode[];
}

export interface CatalogShow {
  id: number;
  slug: string;
  title: string;
  synopsis?: string | null;
  section: string;
  categories: string[];
  trailers: CatalogTrailer[];
  seasons: CatalogSeason[];
}

export interface CatalogSection {
  key: string;
  shows: CatalogShow[];
}

export interface Catalog {
  version: number;
  published_at: string | null;
  publish_run_id: number | null;
  sections: CatalogSection[];
}

export interface SearchQuery {
  q?: string | null;
  category?: string | null;
  language?: string | null;
  section?: string | null;
}

export interface SearchResponse {
  query: SearchQuery;
  count: number;
  results: CatalogShow[];
}

/**
 * Well-known section keys. The backend publisher always emits
 * sections in this order. The Viewer renders them in the same
 * order and labels them consistently.
 */
export const SECTION_KEYS = ['featured', 'series', 'minisodes', 'songs'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/**
 * Human-friendly labels for the known section keys. The Viewer
 * only renders rows for these four; any other section key
 * returned by the API still renders with a derived label
 * (`titleCase(key)`).
 */
export const SECTION_LABELS: Record<string, string> = {
  featured: 'Featured',
  series: 'Series',
  minisodes: 'Minisodes',
  songs: 'Songs',
};

export function sectionLabel(key: string): string {
  if (SECTION_LABELS[key]) return SECTION_LABELS[key]!;
  const k = key.trim();
  if (!k) return 'More';
  return k.charAt(0).toUpperCase() + k.slice(1);
}
