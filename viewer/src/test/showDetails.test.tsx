/**
 * Tests for the show detail page.
 */
import { afterEach, describe, it, expect } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { renderApp, mockFetchWith } from './testUtils';
import { makeFullCatalog, makeShow } from './fixtures';

describe('SHOW DETAILS: rendering', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders show title, synopsis, and categories', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });

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

    // Wait for the season block to appear (indicating data has loaded)
    await waitFor(
      () => {
        expect(screen.getByTestId('season-block')).toBeInTheDocument();
      },
      { client },
    );
    // There are multiple episode rows: trailers (1) + season episodes (2) = 3 total
    // Use getAllByTestId since we expect multiple rows
    const episodes = screen.getAllByTestId('episode-row');
    expect(episodes.length).toBeGreaterThan(0);
  });

  it('renders episode titles', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });

    // Wait for the season block to appear (indicating data has loaded)
    await waitFor(
      () => {
        expect(screen.getByTestId('season-block')).toBeInTheDocument();
      },
      { client },
    );
    // Use getAllByTestId since there are multiple episode titles
    const episodeTitles = screen.getAllByTestId('episode-title');
    expect(episodeTitles.length).toBeGreaterThan(0);
    // Verify the specific episode title appears
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

    // Wait for season block to appear (data loaded)
    await waitFor(
      () => {
        expect(screen.getByTestId('season-block')).toBeInTheDocument();
      },
      { client },
    );
    // There are multiple episodes with language tags (trailer + season episodes)
    // Use getAllByTestId since there can be multiple language elements
    const languageTags = screen.getAllByTestId('episode-languages');
    expect(languageTags.length).toBeGreaterThan(0);
    // Verify the expected content appears (use getAllByText since there may be multiple matches)
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

    await waitFor(
      () => {
        expect(screen.getByTestId('trailer-section')).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId('trailer-title')).toHaveTextContent('Trailers');
  });

  it('does NOT display "Season 0" as a normal season', async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });

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
      ...makeFullCatalog(),
      sections: [{ key: 'series', shows: [emptyShow] }],
    };
    mockFetchWith(() =>
      new Response(JSON.stringify(catalog), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { client } = renderApp({ initialRoute: '/shows/empty-show' });

    await waitFor(
      () => {
        expect(screen.getByTestId('show-no-content')).toBeInTheDocument();
      },
      { client },
    );
  });

  it('shows loading spinner on show page while loading', () => {
    mockFetchWith(() => new Promise(() => {}));
    const { client } = renderApp({ initialRoute: '/shows/moon-adventure' });
    expect(screen.getByTestId('show-loading')).toBeInTheDocument();
    client.cancelQueries();
  });
});
