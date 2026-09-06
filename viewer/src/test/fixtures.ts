/**
 * Sample catalogue fixtures used across tests.
 *
 * Mirrors the shape produced by the backend's catalogue builder
 * and the Pydantic schema in
 * `backend/app/schemas/catalog.py`.
 */
import type { Catalog, CatalogShow } from '../types/catalog';

export function makeEpisode(overrides: Partial<{
  content_group: string;
  languages: string[];
  canonical_language: string;
  title: string;
  episode_number: number;
  duration: number | null;
  artwork: Record<string, { type: string; url: string; width?: number; height?: number }>;
}> = {}) {
  return {
    content_group: 'cg-1',
    languages: ['en'],
    canonical_language: 'en',
    title: 'Episode 1',
    episode_number: 1,
    duration: 600,
    artwork: {
      thumbnail: {
        type: 'thumbnail',
        url: 'https://example.com/thumb1.jpg',
        width: 320,
        height: 180,
      },
    },
    ...overrides,
  };
}

export function makeShow(overrides: Partial<CatalogShow> = {}): CatalogShow {
  return {
    id: 1,
    slug: 'moon-adventure',
    title: 'Moon Adventure',
    synopsis: 'A grand journey to the moon.',
    section: 'series',
    categories: ['Adventure', 'Family'],
    trailers: [
      makeEpisode({
        content_group: 'trailer-1',
        title: 'Official Trailer',
        episode_number: 0,
        languages: ['en', 'hi'],
        canonical_language: 'en',
        artwork: {
          thumbnail: { type: 'thumbnail', url: 'https://example.com/trailer1.jpg' },
          poster: { type: 'poster', url: 'https://example.com/trailer1-poster.jpg' },
        },
      }),
    ],
    seasons: [
      {
        season_number: 1,
        episodes: [
          makeEpisode({
            content_group: 's1e1',
            title: 'Lift Off',
            languages: ['en', 'hi'],
            canonical_language: 'en',
            duration: 600,
            artwork: {
              poster: { type: 'poster', url: 'https://example.com/s1e1-poster.jpg' },
              banner: { type: 'banner', url: 'https://example.com/s1e1-banner.jpg' },
              thumbnail: { type: 'thumbnail', url: 'https://example.com/s1e1-thumb.jpg' },
            },
          }),
          makeEpisode({
            content_group: 's1e2',
            title: 'First Steps',
            languages: ['en'],
            canonical_language: 'en',
            duration: 720,
            artwork: {
              thumbnail: { type: 'thumbnail', url: 'https://example.com/s1e2-thumb.jpg' },
            },
          }),
        ],
      },
    ],
    ...overrides,
  };
}

export function makeFeaturedShow(): CatalogShow {
  return makeShow({
    id: 100,
    slug: 'featured-show',
    title: 'Featured Hit',
    synopsis: 'The featured show of the month.',
    section: 'featured',
    categories: ['Drama'],
    trailers: [],
    seasons: [
      {
        season_number: 1,
        episodes: [
          makeEpisode({
            content_group: 'fs-1',
            title: 'Pilot',
            languages: ['en'],
            canonical_language: 'en',
            duration: 1200,
            artwork: {
              banner: { type: 'banner', url: 'https://example.com/featured-banner.jpg' },
              poster: { type: 'poster', url: 'https://example.com/featured-poster.jpg' },
              thumbnail: { type: 'thumbnail', url: 'https://example.com/featured-thumb.jpg' },
            },
          }),
        ],
      },
    ],
  });
}

export function makeFullCatalog(): Catalog {
  return {
    version: 1,
    published_at: '2024-01-15T10:30:00Z',
    publish_run_id: 42,
    sections: [
      { key: 'featured', shows: [makeFeaturedShow()] },
      { key: 'series', shows: [makeShow()] },
      { key: 'minisodes', shows: [
        makeShow({
          id: 2,
          slug: 'mini-tale',
          title: 'Mini Tale',
          section: 'minisodes',
          categories: ['Mini'],
          trailers: [],
        }),
      ] },
      { key: 'songs', shows: [
        makeShow({
          id: 3,
          slug: 'happy-songs',
          title: 'Happy Songs',
          section: 'songs',
          categories: ['Songs'],
          trailers: [],
        }),
      ] },
    ],
  };
}

export function makeEmptyCatalog(): Catalog {
  return {
    version: 1,
    published_at: '2024-01-01T00:00:00Z',
    publish_run_id: null,
    sections: [],
  };
}
