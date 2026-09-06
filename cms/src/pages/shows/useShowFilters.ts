/**
 * useShowFilters — read/write the show-list filter state from URL search
 * params so the URL stays shareable / refreshable.
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type {
  ListShowsParams,
} from '../../api/shows';
import type {
  ShowSection,
  ShowStatus,
} from '../../types/api';

const PAGE_SIZE = 20;

export interface ShowFilters {
  search: string;
  status: ShowStatus | '';
  section: ShowSection | '';
  page: number;
  pageSize: number;
}

export interface ShowFiltersApi extends Omit<ListShowsParams, 'status' | 'section'> {
  status?: ShowStatus;
  section?: ShowSection;
  page: number;
  page_size: number;
}

/** Parse URLSearchParams → strongly-typed filter object. */
function readFromUrl(params: URLSearchParams): ShowFilters {
  const search = params.get('search') ?? '';
  const status = (params.get('status') ?? '') as ShowStatus | '';
  const section = (params.get('section') ?? '') as ShowSection | '';
  const pageRaw = Number(params.get('page') ?? '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  return { search, status, section, page, pageSize: PAGE_SIZE };
}

function writeToUrl(
  current: URLSearchParams,
  patch: Partial<ShowFilters>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  const setOrDelete = (key: string, value: string | number | null | undefined) => {
    if (value === '' || value === null || value === undefined) {
      next.delete(key);
    } else {
      next.set(key, String(value));
    }
  };
  if ('search' in patch) setOrDelete('search', patch.search);
  if ('status' in patch) setOrDelete('status', patch.status);
  if ('section' in patch) setOrDelete('section', patch.section);
  if ('page' in patch) setOrDelete('page', patch.page);
  void PAGE_SIZE;
  return next;
}

export function useShowFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFromUrl(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<ShowFilters>) => {
      setSearchParams((current) => writeToUrl(current, patch), { replace: true });
    },
    [setSearchParams],
  );

  const apiParams: ShowFiltersApi = useMemo(
    () => ({
      search: filters.search || undefined,
      status: filters.status || undefined,
      section: filters.section || undefined,
      page: filters.page,
      page_size: filters.pageSize,
    }),
    [filters],
  );

  return { filters, apiParams, update };
}