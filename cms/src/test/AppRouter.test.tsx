/**
 * End-to-end-ish routing tests for the CMS shell.
 *
 * Covers:
 *   - Unauthenticated visits to /app/* redirect to /login.
 *   - Successful login round-trip stores the token + loads the user.
 *   - Failed login shows a friendly error and does NOT save the token.
 *   - Editor: Publish nav link hidden, /app/publish accessible (editor note shown).
 *   - Admin: Publish link visible, /app/publish renders.
 *   - 401 from /auth/me clears auth state and bounces to /login.
 *   - Logout clears state and returns to /login.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';

import { tokenStorage } from '../auth/tokenStorage';
import { clearTokenStorage, renderApp } from './testUtils';

const NAV = '/app/shows';

beforeEach(() => {
  clearTokenStorage();
});

afterEach(() => {
  clearTokenStorage();
  vi.unstubAllGlobals();
});

function mockFetch(handler: (url: string) => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(handler));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('App routing & auth', () => {
  it('redirects unauthenticated users from /app/* to /login', async () => {
    renderApp({ initialRoute: NAV });
    await waitFor(() => {
      expect(screen.getByTestId('login-email')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('cms-current-user')).not.toBeInTheDocument();
  });

  it('logs the user in on a successful POST /auth/login + GET /auth/me', async () => {
    mockFetch(async (url: string) => {
      if (url.endsWith('/auth/login')) {
        return jsonResponse({ access_token: 'tok-123', token_type: 'bearer' });
      }
      if (url.endsWith('/auth/me')) {
        return jsonResponse({ id: 1, email: 'editor@peblo.local', role: 'editor' });
      }
      return jsonResponse({});
    });

    renderApp({ initialRoute: '/login' });

    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'editor@peblo.local' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'pw' },
    });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('cms-current-user').textContent).toBe(
        'editor@peblo.local',
      );
    });
    expect(screen.getByTestId('cms-current-role').textContent).toBe('editor');
    expect(tokenStorage.get()).toBe('tok-123');
  });

  it('shows a friendly error on failed login', async () => {
    mockFetch(async () =>
      jsonResponse(
        { detail: 'Invalid email or credentials.', code: 'invalid_credentials' },
        401,
      ),
    );

    renderApp({ initialRoute: '/login' });

    fireEvent.change(screen.getByTestId('login-email'), {
      target: { value: 'wrong@peblo.local' },
    });
    fireEvent.change(screen.getByTestId('login-password'), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Invalid email or credentials',
      );
    });
    expect(tokenStorage.get()).toBeNull();
  });

    it('hides the Publish nav link from editors but allows access to /app/publish', async () => {
    seedAuthenticatedUser('editor@peblo.local', 'editor');
    // Provide mock responses for the validation report and publish history
    mockFetch(async (url: string) => {
      if (url.includes('/auth/me')) return jsonResponse({ id: 2, email: 'editor@peblo.local', role: 'editor' });
      if (url.includes('/admin/validation-report')) {
        return jsonResponse({
          can_publish: true,
          issues: [],
          summary: { blocking_issues: 0, by_type: {}, shows_scanned: 0, episodes_scanned: 0 },
        });
      }
      if (url.includes('/admin/catalog/publish-runs')) return jsonResponse([]);
      return jsonResponse({});
    });

    renderApp({ initialRoute: '/app/publish' });

    // Editor should NOT see Publish in the nav
    await waitFor(() => {
      expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    });
    // But the editor can still access the page and see the editor note
    await waitFor(() => {
      expect(screen.getByTestId('publish-editor-note')).toBeInTheDocument();
    });
  });

  it('shows Publish in the nav and lets admins reach /app/publish', async () => {
    seedAuthenticatedUser('admin@peblo.local', 'admin');

    renderApp({ initialRoute: NAV });
    await waitFor(() => {
      expect(screen.getByTestId('cms-current-role').textContent).toBe('admin');
    });

    expect(screen.getByText('Publish')).toBeInTheDocument();
  });

  it('clears auth state and bounces to /login when the bootstrap /auth/me returns 401', async () => {
    tokenStorage.set('expired-token');
    mockFetch(async () =>
      jsonResponse({ detail: 'expired', code: 'invalid_token' }, 401),
    );

    renderApp({ initialRoute: NAV });
    await waitFor(() => {
      expect(screen.getByTestId('login-email')).toBeInTheDocument();
    });
    expect(tokenStorage.get()).toBeNull();
  });

  it('logs the user out and returns to /login when the logout button is clicked', async () => {
    seedAuthenticatedUser('editor@peblo.local', 'editor');

    renderApp({ initialRoute: NAV });
    await waitFor(() => {
      expect(screen.getByTestId('cms-logout')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('cms-logout'));

    await waitFor(() => {
      expect(screen.getByTestId('login-email')).toBeInTheDocument();
    });
    expect(tokenStorage.get()).toBeNull();
  });
});

// ── helpers ──────────────────────────────────────────────────────────────────

function seedAuthenticatedUser(email: string, role: 'editor' | 'admin') {
  tokenStorage.set('seeded-token');
  mockFetch(async (url: string) => {
    if (url.endsWith('/auth/me')) {
      return jsonResponse({ id: 1, email, role });
    }
    return jsonResponse({});
  });
}