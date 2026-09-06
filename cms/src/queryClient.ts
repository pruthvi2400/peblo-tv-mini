/**
 * Shared TanStack QueryClient.
 *
 * Defaults chosen for a CMS:
 *   - staleTime 30s  : backend writes are infrequent; a short cache
 *                       keeps repeated navigation snappy.
 *   - refetchOnWindowFocus: false
 *                       : editor-driven app; refetch on tab focus is
 *                       noisy.
 *   - retry: 1        : generic reads retry once on transient network
 *                       blips; auth endpoints opt out per-query.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});