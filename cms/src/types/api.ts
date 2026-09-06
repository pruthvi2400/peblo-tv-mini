/**
 * Centralised TypeScript types mirroring the FastAPI backend response
 * models that the CMS consumes.
 *
 * The shape of every type below was read straight from the backend
 * Pydantic schemas (see backend/app/schemas/*.py) so the CMS does not
 * silently drift from the server contract. When the backend changes a
 * field, TypeScript will catch it here at compile time.
 */

// ── Shared / utility types ────────────────────────────────────────────────────

/** ISO-8601 datetime string returned by the backend. */
export type ISODateTime = string;

/** Pagination envelope returned by every list endpoint. */
export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

/** Structured error envelope returned by the backend (see api/errors.py). */
export interface ApiErrorBody {
  detail: string;
  code?: string | null;
  field?: string | null;
  errors?: unknown;
  details?: unknown;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole = 'editor' | 'admin';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
}

export interface CurrentUser {
  id: number;
  email: string;
  role: UserRole;
}

// ── Show / Season / Episode / Artwork ────────────────────────────────────────

export type ShowSection = 'featured' | 'series' | 'minisodes' | 'songs';
export type ShowStatus = 'draft' | 'published' | 'archived';
export type EpisodeStatus = 'draft' | 'published' | 'removed';
export type ArtworkType = 'poster' | 'banner' | 'thumbnail';
export type Language = 'en' | 'hi';

/**
 * Authoritative option lists for forms. Mirrors `app.core.enums` on the
 * backend (which itself sources from `reference.json`). Forms and filter
 * UIs must read from these constants — never hardcode.
 */
export const SHOW_SECTIONS: readonly ShowSection[] = [
  'featured',
  'series',
  'minisodes',
  'songs',
] as const;

export const SHOW_STATUSES: readonly ShowStatus[] = [
  'draft',
  'published',
  'archived',
] as const;

export const EPISODE_STATUSES: readonly EpisodeStatus[] = [
  'draft',
  'published',
  'removed',
] as const;

export const LANGUAGES: readonly Language[] = ['en', 'hi'] as const;

export const CATEGORIES: readonly string[] = [
  'adventure',
  'folk',
  'friendship',
  'india',
  'language',
  'learning',
  'maths',
  'music',
  'nature',
  'reading',
  'science',
  'singalong',
  'stories',
  'travel',
  'values',
] as const;

export interface Show {
  id: number;
  title: string;
  slug: string;
  synopsis: string | null;
  section: ShowSection;
  status: ShowStatus;
  categories: string[];
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Season {
  id: number;
  show_id: number;
  season_number: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Artwork {
  id: number;
  episode_id: number;
  artwork_type: ArtworkType;
  storage_key: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  mime_type: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Episode {
  id: number;
  season_id: number;
  title: string;
  episode_number: number;
  duration: number | null;
  language: string;
  content_group: string;
  status: EpisodeStatus;
  artwork: Artwork[];
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Artwork {
  id: number;
  episode_id: number;
  artwork_type: ArtworkType;
  storage_key: string;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  mime_type: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ── Validation report (Phase 4) ──────────────────────────────────────────────

export type ValidationIssueType =
  | 'missing_section'
  | 'missing_categories'
  | 'missing_duration'
  | 'missing_artwork';

export interface ValidationIssue {
  type: ValidationIssueType | string;
  severity: 'blocking' | string;
  entity: 'show' | 'episode' | string;
  entity_id: number;
  title: string;
  message: string;
  fields: Record<string, unknown>;
}

export interface ValidationSummary {
  blocking_issues: number;
  by_type: Record<string, number>;
  shows_scanned: number;
  episodes_scanned: number;
}

export interface ValidationReport {
  can_publish: boolean;
  issues: ValidationIssue[];
  summary: ValidationSummary;
}

// ── Publish (Phase 6) ────────────────────────────────────────────────────────

export type PublishStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PublishRun {
  id: number;
  triggered_by_user_id: number | null;
  started_at: ISODateTime;
  completed_at: ISODateTime | null;
  status: PublishStatus;
  shows_count: number | null;
  seasons_count: number | null;
  episodes_count: number | null;
  error_message: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PublishResult {
  status: 'completed' | 'failed' | string;
  run_id: number | null;
  started_at: ISODateTime | null;
  completed_at: ISODateTime | null;
  shows_count: number;
  seasons_count: number;
  episodes_count: number;
  error_message?: string;
  validation?: ValidationReport;
}

// ── CRUD request payloads ────────────────────────────────────────────────────

/**
 * Mirrors `ShowCreate` in `app.schemas.show`.
 * Categories are a string[] of values from `CATEGORIES`; the backend
 * validates each value against `reference.json`.
 */
export interface ShowCreateInput {
  title: string;
  slug: string;
  synopsis: string | null;
  section: ShowSection;
  status: ShowStatus;
  categories: string[];
}

/**
 * Mirrors `ShowUpdate` — every field is optional (partial update).
 * `null` for `synopsis` clears the field; omit to leave unchanged.
 */
export interface ShowUpdateInput {
  title?: string;
  slug?: string;
  synopsis?: string | null;
  section?: ShowSection;
  status?: ShowStatus;
  categories?: string[];
}

/** Mirrors `SeasonCreate`. */
export interface SeasonCreateInput {
  show_id: number;
  season_number: number;
}

/** Mirrors `SeasonUpdate`. */
export interface SeasonUpdateInput {
  season_number?: number;
}

/**
 * Mirrors `EpisodeCreate`. `artwork` is omitted at creation time in the
 * Phase 7B UI (artwork upload ships in 7C); defaults to [].
 */
export interface EpisodeCreateInput {
  season_id: number;
  title: string;
  episode_number: number;
  duration: number | null;
  language: Language;
  content_group: string;
  status: EpisodeStatus;
  artwork?: never[];
}

/** Mirrors `EpisodeUpdate`. */
export interface EpisodeUpdateInput {
  title?: string;
  episode_number?: number;
  duration?: number | null;
  language?: Language;
  content_group?: string;
  status?: EpisodeStatus;
  season_id?: number;
}