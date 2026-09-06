/**
 * Centralised TanStack Query keys.
 *
 * Every key used in the CMS goes through here so cache invalidation
 * stays consistent. Components / hooks never inline string keys.
 */

export const queryKeys = {
  shows: {
    all: ['shows'] as const,
    list: (params: Record<string, unknown>) =>
      ['shows', 'list', params] as const,
    detail: (id: number) => ['shows', 'detail', id] as const,
  },
  seasons: {
    all: ['seasons'] as const,
    list: (params: Record<string, unknown>) =>
      ['seasons', 'list', params] as const,
    detail: (id: number) => ['seasons', 'detail', id] as const,
  },
  episodes: {
    all: ['episodes'] as const,
    list: (params: Record<string, unknown>) =>
      ['episodes', 'list', params] as const,
    detail: (id: number) => ['episodes', 'detail', id] as const,
  },
  currentUser: {
    all: ['current-user'] as const,
  },
  validation: {
    all: ['validation'] as const,
    report: () => ['validation', 'report'] as const,
  },
  publish: {
    all: ['publish'] as const,
    runs: (params: Record<string, unknown>) =>
      ['publish', 'runs', params] as const,
  },
  artwork: {
    all: ['artwork'] as const,
    byEpisode: (episodeId: number) =>
      ['artwork', 'episode', episodeId] as const,
  },
};