/**
 * TanStack Query hook for the full published catalogue.
 *
 * The home page uses the entire catalogue to render section rows
 * (Featured, Series, Minisodes, Songs). The viewer never needs to
 * re-fetch the same document on every navigation within the app,
 * so we cache it aggressively.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getCatalog } from '../api/client';
import type { Catalog } from '../types/catalog';

export const CATALOG_QUERY_KEY = ['catalog'] as const;

export function useCatalog(): UseQueryResult<Catalog, Error> {
  return useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: getCatalog,
    // The catalogue changes only on publish. Cache for the whole
    // browser session: 5 minutes staleTime plus 30 minutes gcTime
    // means the user keeps the same snapshot during normal use.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
