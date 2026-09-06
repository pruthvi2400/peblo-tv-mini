/**
 * Tests for the show detail page.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { renderApp, mockFetchWith, restoreFetch } from './testUtils';
import { makeFullCatalog, makeShow } from './fixtures';

describe('SHOW DETAILS: rendering', () => {
  let currentClient: ReturnType<typeof renderApp>['client'] | undefined;

  afterEach(() => { restoreFetch(); if (currentClient) { currentClient.clear(); } cleanup(); });

  it('renders show title, synopsis, and categories', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('show-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('show-title')).toHaveTextContent('Moon Adventure');
    expect(screen.getByTestId('show-synopsis')).toHaveTextContent(
      'A grand journey to the moon.',
    );
    expect(screen.getByTestId('show-categories')).toBeInTheDocument();
  });

  it('renders a back link to home', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('back-link')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('back-link')).toHaveAttribute('href', '/');
  });

  it('shows not-found for a non-existent slug', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/does-not-exist' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('show-not-found')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByText(/show not found/i)).toBeInTheDocument();
  });

  it('renders season blocks with season number', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('season-block')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('season-title')).toHaveTextContent('Season 1');
  });

  it('renders episodes within a season', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('season-block')).toBeInTheDocument();
      },
      { client },
    );
    const episodeRows = screen.getAllByTestId('episode-row');
    expect(episodeRows.length).toBeGreaterThan(0);
    const episodeTitles = screen.getAllByTestId('episode-title');
    expect(episodeTitles.length).toBeGreaterThan(0);
    expect(screen.getByText('Lift Off')).toBeInTheDocument();
  });

  it('renders language tags for episodes with multiple languages', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('season-block')).toBeInTheDocument();
      },
      { client },
    );
    const languageTags = screen.getAllByTestId('episode-languages');
    expect(languageTags.length).toBeGreaterThan(0);
    const matchingElements = screen.getAllByText(/en.*\|.*hi/i);
    expect(matchingElements.length).toBeGreaterThan(0);
  });

  it('renders trailers separately from seasons', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('trailer-section')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('trailer-title')).toHaveTextContent('Trailers');
  });

  it('does NOT display Season 0 as a normal season', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('show-page')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.queryByText(/season\s*0/i)).not.toBeInTheDocument();
  });

  it('shows no-content message when show has no episodes or trailers', async () => {
    const emptyShow = makeShow({
      id: 99,
      slug: 'empty-show',
      trailers: [],
      seasons: [],
    });
    const catalog = {
      version: 1,
      published_at: '2024-01-01T00:00:00Z',
      publish_run_id: null,
      sections: [{ key: 'series', shows: [emptyShow] }],
    };
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/empty-show' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('show-no-content')).toBeInTheDocument();
      },
      { client },
    );
  });

  it('shows loading spinner on show page while loading', async () => {
    mockFetchWith(() => new Promise(() => {}));
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    currentClient = client;

    await waitFor(
      () => {
        expect(screen.getByTestId('show-loading')).toBeInTheDocument();
      },
      { client },
    );
    client.cancelQueries();
  });
});
