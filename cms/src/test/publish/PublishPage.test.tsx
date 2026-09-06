/**
 * Tests for PublishPage (Phase 7C).
 */
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStorage } from "../../auth/tokenStorage";
import { clearTokenStorage, renderApp } from "../testUtils";
import type { PublishRun, ValidationReport } from "../../types/api";

const NAV = "/app/publish";

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

function mockFetch(handler: (url: string) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(handler));
}

function seedAdmin() {
  tokenStorage.set("admin-token");
  mockFetch(async (url: string) => {
    if (url.includes("/auth/me")) {
      return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
    }
    return jsonResponse({});
  });
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

const CLEAN_REPORT: ValidationReport = {
  can_publish: true,
  issues: [],
  summary: {
    blocking_issues: 0,
    by_type: {},
    shows_scanned: 5,
    episodes_scanned: 12,
  },
};

const BLOCKED_REPORT: ValidationReport = {
  can_publish: false,
  issues: [
    {
      type: "missing_duration",
      severity: "blocking",
      entity: "episode",
      entity_id: 3,
      title: "Pilot (main, en)",
      message: "Published episode Pilot (main, en) (id=3) is missing a duration.",
      fields: { content_group: "main", language: "en" },
    },
    {
      type: "missing_artwork",
      severity: "blocking",
      entity: "episode",
      entity_id: 3,
      title: "Pilot (main, en)",
      message:
        "Published episode Pilot (main, en) (id=3) is missing required artwork: [poster].",
      fields: { content_group: "main", language: "en", missing_types: ["poster"] },
    },
  ],
  summary: {
    blocking_issues: 2,
    by_type: { missing_duration: 1, missing_artwork: 1 },
    shows_scanned: 5,
    episodes_scanned: 12,
  },
};

const EMPTY_RUNS: PublishRun[] = [];

const SAMPLE_RUNS: PublishRun[] = [
  {
    id: 2,
    triggered_by_user_id: 1,
    started_at: "2026-01-02T10:00:00Z",
    completed_at: "2026-01-02T10:00:45Z",
    status: "completed",
    shows_count: 5,
    seasons_count: 10,
    episodes_count: 22,
    error_message: null,
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-02T10:00:45Z",
  },
  {
    id: 1,
    triggered_by_user_id: 1,
    started_at: "2026-01-01T09:00:00Z",
    completed_at: "2026-01-01T09:00:12Z",
    status: "failed",
    shows_count: 5,
    seasons_count: 10,
    episodes_count: 22,
    error_message: "Validation failed.",
    created_at: "2026-01-01T09:00:00Z",
    updated_at: "2026-01-01T09:00:12Z",
  },
];

describe("PublishPage", () => {
  it("shows validation report with no blocking issues", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(CLEAN_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("validation-report")).toBeInTheDocument();
    });
    expect(screen.getByTestId("validation-banner")).toHaveAttribute("data-can-publish", "true");
    expect(screen.getByText(/no blocking issues/i)).toBeInTheDocument();
  });

  it("shows blocking issues grouped by type", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(BLOCKED_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("validation-report")).toBeInTheDocument();
    });
    expect(screen.getByTestId("validation-banner")).toHaveAttribute("data-can-publish", "false");
    expect(screen.getByText(/publish blocked by 2 issues/i)).toBeInTheDocument();
    expect(screen.getByTestId("validation-group-missing_duration")).toBeInTheDocument();
    expect(screen.getByTestId("validation-group-missing_artwork")).toBeInTheDocument();
    expect(screen.getByTestId("validation-item-missing_duration-3")).toBeInTheDocument();
  });

  it("disables Publish button when can_publish is false", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(BLOCKED_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("publish-button")).toBeInTheDocument();
    });
    expect(screen.getByTestId("publish-button")).toBeDisabled();
  });

  it("enables Publish button when can_publish is true", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(CLEAN_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("publish-button")).toBeEnabled();
    });
  });

  it("opens confirmation dialog when Publish is clicked", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(CLEAN_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("publish-button")).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId("publish-button"));
    await waitFor(() => {
      expect(screen.getByTestId("publish-confirm")).toBeInTheDocument();
    });
    expect(screen.getByText(/run publish pipeline/i)).toBeInTheDocument();
  });

  it("shows success result after successful publish", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(CLEAN_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      if (url.includes("/admin/catalog/publish")) {
        return jsonResponse({
          status: "completed",
          run_id: 42,
          started_at: "2026-01-01T10:00:00Z",
          completed_at: "2026-01-01T10:00:30Z",
          shows_count: 5,
          seasons_count: 10,
          episodes_count: 22,
        });
      }
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("publish-button")).toBeEnabled();
    });
    fireEvent.click(screen.getByTestId("publish-button"));
    await waitFor(() => {
      expect(screen.getByTestId("publish-confirm")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("confirm-confirm"));
    await waitFor(() => {
      expect(screen.getByTestId("publish-result")).toBeInTheDocument();
    });
    expect(screen.getByTestId("publish-result")).toHaveAttribute("data-result-kind", "ok");
    expect(screen.getByText(/publish #42 completed/i)).toBeInTheDocument();
  });

  it("shows editor note instead of Publish button for editors", async () => {
    seedEditor();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 2, email: "editor@peblo.local", role: "editor" });
      if (url.includes("/admin/validation-report")) return jsonResponse(CLEAN_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(EMPTY_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("validation-report")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("publish-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("publish-editor-note")).toBeInTheDocument();
    expect(screen.getByText(/only admins can publish/i)).toBeInTheDocument();
  });

  it("shows publish history with runs", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      if (url.includes("/admin/validation-report")) return jsonResponse(CLEAN_REPORT);
      if (url.includes("/admin/catalog/publish-runs")) return jsonResponse(SAMPLE_RUNS);
      return jsonResponse({});
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByTestId("publish-history")).toBeInTheDocument();
    });
    expect(screen.getByTestId("publish-runs-table")).toBeInTheDocument();
    expect(screen.getByTestId("publish-run-2")).toBeInTheDocument();
    expect(screen.getByTestId("publish-run-1")).toBeInTheDocument();
  });

  it("shows error state when validation report fetch fails", async () => {
    seedAdmin();
    mockFetch(async (url: string) => {
      if (url.includes("/auth/me")) return jsonResponse({ id: 1, email: "admin@peblo.local", role: "admin" });
      throw new Error("Network failure");
    });
    renderApp({ initialRoute: NAV, queryClient: freshClient() });
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });
});
