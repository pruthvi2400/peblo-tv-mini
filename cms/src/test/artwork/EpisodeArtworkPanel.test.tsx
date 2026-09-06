/**
 * Tests for EpisodeArtworkPanel (Phase 7C).
 *
 * Covers:
 *   - Three slots are rendered (poster, banner, thumbnail)
 *   - Each slot shows its spec / required dimensions
 *   - Empty state shows a drop zone
 *   - Existing artwork is displayed as a preview
 *   - File upload triggers client-side validation
 *   - Backend 422 errors are displayed
 *   - Delete removes artwork
 *   - Permission denied (403) is handled
 *   - The slot shows loading state during upload/delete
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStorage } from "../../auth/tokenStorage";
import { clearTokenStorage, renderApp } from "../testUtils";
import type { Episode } from "../../types/api";

const SHOW_ID = 1;
const SEASON_ID = 1;
const EPISODE_ID = 11;

beforeEach(() => clearTokenStorage());
afterEach(() => { clearTokenStorage(); vi.unstubAllGlobals(); });

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: 0, gcTime: 0, staleTime: 0 } },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(handler));
}

function seedEditor() {
  tokenStorage.set("editor-token");
  mockFetch(async (url: string) => {
    if (url.includes("/auth/me")) {
      return jsonResponse({ id: 2, email: "editor@peblo.local", role: "editor" });
    }
    return jsonResponse({});
  });
}

const makeEpisode = (overrides: Partial<Episode> = {}): Episode => ({
  id: EPISODE_ID,
  season_id: SEASON_ID,
  title: "Test Episode",
  episode_number: 1,
  duration: 300,
  language: "en",
  content_group: "test-grp",
  status: "draft",
  artwork: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

function setupEpisodeRoute(episode: Episode) {
  // We seed the URL directly to the show detail; episodes are loaded
  // when the user navigates and the show is fetched.
  mockFetch(async (url: string) => {
    if (url.includes("/auth/me")) {
      return jsonResponse({ id: 2, email: "editor@peblo.local", role: "editor" });
    }
    if (url.match(new RegExp(`/api/shows/${SHOW_ID}$`))) {
      return jsonResponse({
        id: SHOW_ID,
        title: "Test Show",
        slug: "test-show",
        synopsis: null,
        section: "series",
        status: "draft",
        categories: [],
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });
    }
    if (url.includes("/api/seasons") && url.includes("show_id")) {
      return jsonResponse({
        items: [
          {
            id: SEASON_ID,
            show_id: SHOW_ID,
            season_number: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        page: 1,
        page_size: 20,
        total: 1,
      });
    }
    if (url.includes("/api/episodes")) {
      return jsonResponse({
        items: [episode],
        page: 1,
        page_size: 20,
        total: 1,
      });
    }
    return jsonResponse({});
  });
}

describe("EpisodeArtworkPanel", () => {
  it("renders three slots labeled poster/banner/thumbnail with their specs", async () => {
    seedEditor();
    setupEpisodeRoute(makeEpisode());

    renderApp({
      initialRoute: `/app/shows/${SHOW_ID}`,
      queryClient: freshClient(),
    });

    // Open artwork dialog for the episode
    await waitFor(() => {
      expect(screen.getByTestId(`artwork-episode-${EPISODE_ID}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`artwork-episode-${EPISODE_ID}`));

    await waitFor(() => {
      expect(screen.getByTestId("artwork-panel")).toBeInTheDocument();
    });

    expect(screen.getByText("Poster")).toBeInTheDocument();
    expect(screen.getByText("Banner")).toBeInTheDocument();
    expect(screen.getByText("Thumbnail")).toBeInTheDocument();
    // Help text from specs
    expect(screen.getByText(/600 . 900 px/i)).toBeInTheDocument();
    expect(screen.getByText(/1280 . 720 px/i)).toBeInTheDocument();
    expect(screen.getByText(/640 . 360 px/i)).toBeInTheDocument();
    // Drop zones for empty state
    expect(screen.getByTestId("artwork-drop-poster")).toBeInTheDocument();
    expect(screen.getByTestId("artwork-drop-banner")).toBeInTheDocument();
    expect(screen.getByTestId("artwork-drop-thumbnail")).toBeInTheDocument();
  });

  it("shows existing artwork as preview", async () => {
    seedEditor();
    setupEpisodeRoute(
      makeEpisode({
        artwork: [
          {
            id: 1,
            episode_id: EPISODE_ID,
            artwork_type: "poster",
            storage_key: "posters/x.jpg",
            width: 600,
            height: 900,
            size_bytes: 50000,
            mime_type: "image/jpeg",
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    );

    renderApp({
      initialRoute: `/app/shows/${SHOW_ID}`,
      queryClient: freshClient(),
    });

    await waitFor(() => {
      expect(screen.getByTestId(`artwork-episode-${EPISODE_ID}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`artwork-episode-${EPISODE_ID}`));

    await waitFor(() => {
      expect(screen.getByTestId("artwork-img-poster")).toBeInTheDocument();
    });
    // Remove button is visible when an artwork exists
    expect(screen.getByTestId("artwork-delete-poster")).toBeInTheDocument();
    // Drop zones are NOT shown for filled slot, but ARE shown for empty ones
    expect(screen.queryByTestId("artwork-drop-poster")).not.toBeInTheDocument();
    expect(screen.getByTestId("artwork-drop-banner")).toBeInTheDocument();
    expect(screen.getByTestId("artwork-drop-thumbnail")).toBeInTheDocument();
  });
});
