/**
 * Shared TanStack QueryClient for the Viewer.
 *
 * Defaults chosen for a read-only public catalogue app:
 *   - staleTime 5m   : the published catalogue changes only on
 *                      publish, so a long cache is appropriate.
 *   - refetchOnWindowFocus: false
 *                      : users landing on the tab don't need a
 *                      fresh catalogue.
 *   - retry: 1        : generic reads retry once on transient
 *                      network blips.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
