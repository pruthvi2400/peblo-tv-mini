/**
 * Tests for the search page.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, mockFetchWith, mockFetchResponse } from './testUtils';
import { makeShow } from './fixtures';

describe('SEARCH: filters and results', () => {
  afterEach(() => {
    cleanup();
  });

  it('sends the q parameter to the backend', async () => {
    const mock = mockFetchWith((url) => {
      expect(url).toContain('q=moon');
      return new Response(
        JSON.stringify({ query: { q: 'moon' }, count: 1, results: [makeShow()] }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { client } = renderApp({ initialRoute: '/search?q=moon' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(mock).toHaveBeenCalled();
  });

  it('sends category filter to the backend', async () => {
    const mock = mockFetchWith((url) => {
      expect(url).toContain('category=Songs');
      return new Response(
        JSON.stringify({ query: { category: 'Songs' }, count: 0, results: [] }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { client } = renderApp({ initialRoute: '/search?category=Songs' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(mock).toHaveBeenCalled();
  });

  it('sends language filter to the backend', async () => {
    const mock = mockFetchWith((url) => {
      expect(url).toContain('language=hi');
      return new Response(
        JSON.stringify({ query: { language: 'hi' }, count: 0, results: [] }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { client } = renderApp({ initialRoute: '/search?language=hi' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(mock).toHaveBeenCalled();
  });

  it('sends section filter to the backend', async () => {
    const mock = mockFetchWith((url) => {
      expect(url).toContain('section=series');
      return new Response(
        JSON.stringify({ query: { section: 'series' }, count: 0, results: [] }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { client } = renderApp({ initialRoute: '/search?section=series' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(mock).toHaveBeenCalled();
  });

  it('composes multiple filters together', async () => {
    const mock = mockFetchWith((url) => {
      expect(url).toContain('q=moon');
      expect(url).toContain('language=hi');
      expect(url).toContain('section=series');
      return new Response(
        JSON.stringify({
          query: { q: 'moon', language: 'hi', section: 'series' },
          count: 0,
          results: [],
        }),
        { headers: { 'Content-Type': 'application/json' } },
      );
    });

    const { client } = renderApp({
      initialRoute: '/search?q=moon&language=hi&section=series',
    });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(mock).toHaveBeenCalled();
  });

  it('shows a clear empty state when no results are found', async () => {
    mockFetchResponse({ query: {}, count: 0, results: [] });
    const { client } = renderApp({ initialRoute: '/search?q=nonexistent' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-empty')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('search-empty')).toHaveTextContent(
      /no results found/i,
    );
    expect(screen.getByTestId('search-clear-button')).toBeInTheDocument();
  });

  it('shows search results when results exist', async () => {
    mockFetchResponse({
      query: { q: 'moon' },
      count: 1,
      results: [makeShow({ title: 'Moon Adventure' })],
    });
    const { client } = renderApp({ initialRoute: '/search?q=moon' });

    await waitFor(
      () => {
        expect(screen.getByTestId('search-results')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('show-card-title')).toHaveTextContent(
      'Moon Adventure',
    );
  });

  it('typing in the search input updates the input value', async () => {
    mockFetchResponse({ query: {}, count: 0, results: [] });
    const { client } = renderApp({ initialRoute: '/search' });
    const user = userEvent.setup();

    await waitFor(
      () => {
        expect(screen.getByTestId('search-page')).toBeInTheDocument();
      },
      { client },
    );

    const input = screen.getByTestId('search-input-q');
    await user.clear(input);
    await user.type(input, 'hello');
    expect(input).toHaveValue('hello');
  });
});
