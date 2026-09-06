/**
 * Tests for ShowsListPage (Phase 7B CRUD behavior).
 *
 * Each test uses a fresh QueryClient so staleTime and gcTime do not bleed
 * between cases.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionDeniedError } from '../../api/client';
import { tokenStorage } from '../../auth/tokenStorage';
import { clearTokenStorage, renderApp } from '../testUtils';
import type { Show } from '../../types/api';

const NAV = '/app/shows';

beforeEach(() => clearTokenStorage());
afterEach(() => { clearTokenStorage(); vi.unstubAllGlobals(); });

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0, staleTime: 0 } },
  });
}

const makeShow = (overrides: Partial<Show> = {}): Show => ({
  id: 1, title: 'Test Show', slug: 'test-show', synopsis: 'syn',
  section: 'series', status: 'draft', categories: ['adventure'],
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

const TWO_SHOWS = {
  items: [makeShow({ id: 1, title: 'Alpha Show' }), makeShow({ id: 2, title: 'Beta Show' })],
  page: 1, page_size: 20, total: 2,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function mockFetch(handler: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(handler));
}

function seedAuthenticated(email = 'editor@peblo.local', role: 'editor' | 'admin' = 'editor') {
  tokenStorage.set('seeded-token');
  mockFetch(async (url: string) => {
    if (url.includes('/auth/me')) return jsonResponse({ id: 1, email, role });
    return jsonResponse({});
  });
}

function mockShows(body: unknown) {
  mockFetch(async (url: string) => {
    if (url.includes('/auth/me')) return jsonResponse({ id: 1, email: 'e@e', role: 'editor' });
    if (url.includes('/api/shows')) return jsonResponse(body);
    return jsonResponse({});
  });
}

describe('ShowsListPage', () => {
  it('displays shows table', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText('Alpha Show')).toBeInTheDocument());
    expect(screen.getByText('Beta Show')).toBeInTheDocument();
  });

  it('shows empty state when no shows', async () => {
    seedAuthenticated();
    mockShows({ items: [], page: 1, page_size: 20, total: 0 });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText(/no shows/i)).toBeInTheDocument());
  });

  it('shows error state with retry', async () => {
    seedAuthenticated();
    mockFetch(async (url: string) => {
      if (url.includes('/auth/me')) return jsonResponse({ id: 1, email: 'e@e', role: 'editor' });
      throw new Error('Network failure');
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows permission denied on 403', async () => {
    seedAuthenticated();
    mockFetch(async (url: string) => {
      if (url.includes('/auth/me')) return jsonResponse({ id: 1, email: 'e@e', role: 'editor' });
      throw new PermissionDeniedError({ message: 'Forbidden' });
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText(/permission denied/i)).toBeInTheDocument());
  });

  it('shows Create the first show link in empty state', async () => {
    seedAuthenticated();
    mockShows({ items: [], page: 1, page_size: 20, total: 0 });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText(/no shows/i)).toBeInTheDocument());
    // The "Create the first show" link is rendered inside the EmptyState.
    expect(screen.getByRole('link', { name: /create the first show/i })).toHaveAttribute('href', '/app/shows/new');
  });

  it('sends search param to API', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV + '?search=alpha', queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText('Alpha Show')).toBeInTheDocument());
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as string).includes('/api/shows'),
    )?.[0] as string | undefined;
    expect(url).toBeDefined();
    expect(url).toContain('search=alpha');
  });

  it('sends status+section params to API', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV + '?status=draft&section=series', queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText('Alpha Show')).toBeInTheDocument());
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as string).includes('/api/shows'),
    )?.[0] as string | undefined;
    expect(url).toBeDefined();
    expect(url).toContain('status=draft');
    expect(url).toContain('section=series');
  });

  it('shows pagination info', async () => {
    seedAuthenticated();
    mockShows({ items: [makeShow()], page: 2, page_size: 20, total: 25 });
    renderApp({ initialRoute: NAV + '?page=2', queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText(/Page 2/i)).toBeInTheDocument());
    expect(screen.getByText(/25 shows/i)).toBeInTheDocument();
  });

  it('renders delete buttons for each show', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByTestId('delete-show-1')).toBeInTheDocument());
    expect(screen.getByTestId('delete-show-2')).toBeInTheDocument();
  });

  it('opens delete confirmation dialog', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByTestId('delete-show-1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('delete-show-1'));
    await waitFor(() => expect(screen.getByText('Delete show?')).toBeInTheDocument());
  });

  it('renders View+Edit links per show', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText('Alpha Show')).toBeInTheDocument());
    const views = screen.getAllByRole('link', { name: /view/i });
    const edits = screen.getAllByRole('link', { name: /edit/i });
    expect(views[0]).toHaveAttribute('href', '/app/shows/1');
    expect(edits[0]).toHaveAttribute('href', '/app/shows/1/edit');
  });

  it('displays section, status, categories, slug', async () => {
    seedAuthenticated();
    mockShows(TWO_SHOWS);
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => expect(screen.getByText('Alpha Show')).toBeInTheDocument());
    // 'series', 'draft', 'adventure', 'test-show' each appear in two rows.
    expect(screen.getAllByText('series').length).toBeGreaterThan(0);
    expect(screen.getAllByText('draft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('adventure').length).toBeGreaterThan(0);
    expect(screen.getAllByText('test-show').length).toBeGreaterThan(0);
  });
});