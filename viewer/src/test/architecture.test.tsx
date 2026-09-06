/**
 * Tests for the Viewer's API client architecture.
 *
 * The Viewer MUST only use public catalogue endpoints
 * (GET /catalog, GET /catalog/search). These tests verify that
 * no CMS / admin / CRUD endpoint is ever called.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { renderApp, mockFetchWith } from './testUtils';
import { makeFullCatalog } from './fixtures';

describe('ARCHITECTURE: only public catalogue endpoints are called', () => {
  afterEach(() => {
    cleanup();
  });

  it('only calls /catalog or /catalog/search on the home page', async () => {
    const catalog = makeFullCatalog();
    const calls: string[] = [];

    mockFetchWith((url) => {
      calls.push(url);
      const isAllowed =
        url.includes('/catalog?') ||
        url.includes('/catalog/search') ||
        /\/catalog$/.test(url);
      expect(isAllowed).toBe(true);
      return new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { client } = renderApp({ initialRoute: '/' });

    await waitFor(
      () => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(calls.length).toBeGreaterThan(0);
  });

  it('does not call any /api/* endpoint from the viewer', async () => {
    const catalog = makeFullCatalog();
    const calls: string[] = [];

    mockFetchWith((url) => {
      calls.push(url);
      return new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { client } = renderApp({ initialRoute: '/' });

    await waitFor(
      () => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      },
      { client },
    );

    const apiCalls = calls.filter(
      (u) =>
        u.includes('/api/shows') ||
        u.includes('/api/seasons') ||
        u.includes('/api/episodes'),
    );
    expect(apiCalls).toHaveLength(0);
  });

  it('does not call any /admin/* endpoint from the viewer', async () => {
    const catalog = makeFullCatalog();
    const calls: string[] = [];

    mockFetchWith((url) => {
      calls.push(url);
      return new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { client } = renderApp({ initialRoute: '/' });

    await waitFor(
      () => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      },
      { client },
    );

    const adminCalls = calls.filter((u) => u.includes('/admin/'));
    expect(adminCalls).toHaveLength(0);
  });

  it('does not call any /auth/* endpoint from the viewer', async () => {
    const catalog = makeFullCatalog();
    const calls: string[] = [];

    mockFetchWith((url) => {
      calls.push(url);
      return new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { client } = renderApp({ initialRoute: '/' });

    await waitFor(
      () => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      },
      { client },
    );

    const authCalls = calls.filter((u) => u.includes('/auth/'));
    expect(authCalls).toHaveLength(0);
  });

  it('uses /catalog/search for the search page', async () => {
    const calls: string[] = [];

    mockFetchWith((url) => {
      calls.push(url);
      if (url.includes('/catalog/search')) {
        return new Response(
          JSON.stringify({ query: { q: 'moon' }, count: 0, results: [] }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(makeFullCatalog()), {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { client } = renderApp({ initialRoute: '/search?q=moon' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );

    const searchCalls = calls.filter((u) => u.includes('/catalog/search'));
    expect(searchCalls.length).toBeGreaterThan(0);
  });
});
