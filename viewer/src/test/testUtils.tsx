// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { App } from '../App';

interface WrapperProps { children?: ReactNode; }

function makeWrapper(queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient();
  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export function Wrapper({ children }: WrapperProps) {
  return makeWrapper()({ children });
}

export function renderWithRouter(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Wrapper, ...options });
}

export interface RenderAppOptions {
  initialRoute: string;
  queryClient?: QueryClient;
}

export function renderApp({ initialRoute, queryClient }: RenderAppOptions) {
  // Always create a NEW QueryClient with default options for each test
  // This ensures complete isolation between tests
  const client = queryClient ?? new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App client={client} />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...utils };
}

// Module-level variable to track the REAL original fetch (saved once, never overwritten).
let __testRealFetch__: typeof fetch | undefined;
// Module-level variable to track the CURRENT (possibly mocked) fetch baseline.
// Updated by mockFetchWith to build a proper mock chain so restoreFetch()
// undoes each mock in the correct order.
let __testOriginalFetch__: typeof fetch | undefined;

export function mockFetchWith(
  handler: (url: string) => Response | Promise<Response>
) {
  // Save the current fetch as the new restore target.
  // On the very first call, __testRealFetch__ is undefined so this also
  // captures the real browser fetch (saved once, never overwritten).
  __testOriginalFetch__ = globalThis.fetch;
  __testRealFetch__ = __testRealFetch__ ?? globalThis.fetch;

  // Create a fresh spy wrapping the handler for this mock.
  const spy = vi.fn(async (url: string | URL, _init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.href : String(url);
    const result = handler(urlStr);
    const response = result instanceof Promise ? await result : result;
    // Return a new Response with the same body to avoid body consumption issues
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });
  });

  // @ts-expect-error - intentionally shadowing fetch for tests
  globalThis.fetch = spy;

  // Return spy so tests can call toHaveBeenCalled() on it
  return Object.assign(spy, {
    restore: () => {
      if (__testOriginalFetch__ !== undefined) {
        globalThis.fetch = __testOriginalFetch__;
      }
    },
  });
}

export function mockFetchResponse(data: unknown) {
  return mockFetchWith(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );
}

// Restore the original fetch - call this in afterEach
export function restoreFetch() {
  if (__testOriginalFetch__ !== undefined) {
    globalThis.fetch = __testOriginalFetch__;
  }
}