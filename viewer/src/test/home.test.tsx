/**
 * Tests for the Viewer home page.
 */
import { afterEach, describe, it, expect } from "vitest";
import { screen, waitFor, cleanup, act } from "@testing-library/react";
import { renderApp, mockFetchWith, restoreFetch } from "./testUtils";
import { makeFullCatalog, makeEmptyCatalog } from "./fixtures";

describe("HOME: loading and empty states", () => {
  afterEach(() => { restoreFetch(); cleanup(); });

  it("renders the home page after successful catalogue load", async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    await waitFor(
      () => {
        expect(screen.getByTestId("home-page")).toBeInTheDocument();
      },
      { client },
    );
  });

  it("shows a loading spinner while fetching", () => {
    mockFetchWith(() => new Promise(() => {}));
    const { client } = renderApp({ initialRoute: "/" });
    expect(screen.getByTestId("home-loading")).toBeInTheDocument();
    client.cancelQueries();
  });

  it("shows an error state when the API fails", async () => {
    // Return a rejected promise to simulate network/server failure.
    // TanStack Query treats a resolved promise as success even with HTTP error status,
    // so we need to reject to trigger the error state.
    mockFetchWith(() => Promise.reject(new Error("Internal Server Error")));
    const { client } = renderApp({ initialRoute: "/" });

    // Wait for TanStack Query to process the rejection and update state.
    // Using act() to ensure React processes the state update.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(
      () => {
        expect(screen.getByTestId("home-error")).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByText(/failed to load catalogue/i)).toBeInTheDocument();
  });

  it("shows empty state when catalogue has no sections", async () => {
    const catalog = makeEmptyCatalog();
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    await waitFor(
      () => {
        expect(screen.getByTestId("home-empty")).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByText(/no content available/i)).toBeInTheDocument();
  });
});

describe("HOME: hero and section rows", () => {
  afterEach(() => { restoreFetch(); cleanup(); });

  it("renders the featured hero when a featured show exists", async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    await waitFor(
      () => {
        expect(screen.getByTestId("hero")).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByTestId("hero-title")).toHaveTextContent("Featured Hit");
    expect(screen.getByTestId("hero-cta")).toBeInTheDocument();
  });

  it("renders a welcome empty hero when no featured show exists", async () => {
    const catalog = makeFullCatalog();
    catalog.sections = catalog.sections.map((s) =>
      s.key === "featured" ? { ...s, shows: [] } : s,
    );
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    await waitFor(
      () => {
        expect(screen.getByTestId("hero-empty")).toBeInTheDocument();
      },
      { client },
    );
    expect(screen.getByText(/welcome to peblo tv/i)).toBeInTheDocument();
  });

  it("renders section rows for non-empty sections", async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    // Use getAllByTestId with length check since multiple section rows are expected
    await waitFor(
      () => {
        expect(screen.getAllByTestId("section-row").length).toBeGreaterThan(0);
      },
      { client },
    );
    const rows = screen.getAllByTestId("section-row");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("skips sections with no shows", async () => {
    const catalog = makeFullCatalog();
    const filteredSections = catalog.sections.filter((s) => s.key !== "songs");
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ...catalog, sections: filteredSections }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    await waitFor(
      () => {
        expect(screen.getByTestId("home-page")).toBeInTheDocument();
      },
      { client },
    );

    const nonEmptySections = filteredSections.filter((s) => s.shows.length > 0);
    // "featured" is rendered by Hero, not as a SectionRow.
    // SectionRow also skips empty sections.
    const expectedRowCount = nonEmptySections.filter((s) => s.key !== "featured").length;
    const rows = screen.getAllByTestId("section-row");
    expect(rows).toHaveLength(expectedRowCount);
    // The featured section should appear in Hero, not as a section row
    const heroSection = filteredSections.find((s) => s.key === "featured");
    if (heroSection && heroSection.shows.length > 0) {
      expect(screen.getByTestId("hero")).toBeInTheDocument();
    }
  });

  it("renders show cards with title and metadata", async () => {
    const catalog = makeFullCatalog();
    mockFetchWith(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { client } = renderApp({ initialRoute: "/" });

    // Use getAllByTestId with length check since multiple show cards are expected
    await waitFor(
      () => {
        expect(screen.getAllByTestId("show-card").length).toBeGreaterThan(0);
      },
      { client },
    );
    // Use getAllByTestId since there can be multiple show card titles
    const showCardTitles = screen.getAllByTestId("show-card-title");
    expect(showCardTitles.length).toBeGreaterThan(0);
  });
});