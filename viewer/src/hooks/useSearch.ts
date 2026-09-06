/**
 * TanStack Query hook for catalogue search.
 *
 * Uses the server-side search endpoint so the browser never needs to
 * download the full catalogue just to filter it. All filter
 * parameters are optional and compose with AND semantics.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { searchCatalog } from '../api/client';
import type { SearchQuery, SearchResponse } from '../types/catalog';

export const SEARCH_QUERY_KEY = 'catalog-search' as const;

export interface SearchParams {
  q?: string | null;
  category?: string | null;
  language?: string | null;
  section?: string | null;
}

export function useSearch(params: SearchParams = {}): UseQueryResult<SearchResponse, Error> {
  const filters: SearchQuery = {
    q: params.q ?? null,
    category: params.category ?? null,
    language: params.language ?? null,
    section: params.section ?? null,
  };

  // Only run the query when at least one filter is set, or when
  // the user explicitly wants all shows (empty search). In either
  // case the backend handles it correctly.
  const hasFilters =
    (filters.q ?? '').trim() !== '' ||
    (filters.category ?? '').trim() !== '' ||
    (filters.language ?? '').trim() !== '' ||
    (filters.section ?? '').trim() !== '';

  return useQuery({
    // Use the filter values as part of the query key so that
    // navigating from one search state to another is tracked separately.
    queryKey: [SEARCH_QUERY_KEY, filters],
    queryFn: () => searchCatalog(filters),
    // Treat an empty search (no filters) as a cheap operation.
    // Do not waste cache on it since the home page covers it.
    staleTime: hasFilters ? 5 * 60_000 : 30_000,
    gcTime: hasFilters ? 10 * 60_000 : 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    // Keep previous data while a new search is in flight (no flashing).
    placeholderData: (prev) => prev,
  });
}
