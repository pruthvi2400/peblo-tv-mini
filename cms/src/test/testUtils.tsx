/**
 * Shared helpers for component tests.
 *
 * The `App` component already wires its own provider tree
 * (QueryClientProvider + AuthProvider + Router). For tests we pass a
 * MemoryRouter via `App`'s `router` prop and a fresh QueryClient via
 * `App`'s `client` prop so navigation is deterministic and no cache
 * leaks between cases.
 */
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';

import { App, type AppProps } from '../App';
import { tokenStorage } from '../auth/tokenStorage';

interface RenderOpts extends RenderOptions {
  initialRoute?: string;
  queryClient?: QueryClient;
}

/**
 * Render `<App />` with a deterministic MemoryRouter underneath. Use
 * this when you want to drive full routing + auth flows.
 */
export function renderApp(opts: RenderOpts = {}): RenderResult {
  const { initialRoute, queryClient: client, ...rest } = opts;

  const Router: AppProps['router'] = ({ children }: { children?: ReactNode }) => (
    <MemoryRouter initialEntries={[initialRoute ?? '/']}>
      {children}
    </MemoryRouter>
  );

  const element: ReactElement<AppProps> = (
    <App router={Router} client={client} />
  );
  return render(element, rest);
}

/**
 * Render an arbitrary React element with the same providers as the App.
 * Use this for unit-testing individual components.
 */
export function renderWithProviders(
  ui: ReactElement,
  _opts: RenderOpts = {},
): RenderResult {
  return render(ui);
}

/**
 * Stub `globalThis.fetch` with a single canned response.
 */
export function mockFetchResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = { 'Content-Type': 'application/json' },
) {
  const mock = vi.fn().mockResolvedValue(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers,
    }),
  );
  vi.stubGlobal('fetch', mock);
  return mock;
}

export function clearTokenStorage() {
  tokenStorage.clear();
}