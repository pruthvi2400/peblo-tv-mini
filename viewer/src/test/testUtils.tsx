// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
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
  const client = queryClient ?? new QueryClient();
  const utils = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { client, ...utils };
}

export function mockFetchWith(
  handler: (url: string) => Response | Promise<Response>
) {
  const originalFetch = globalThis.fetch;
  // @ts-expect-error - intentionally shadowing fetch for tests
  globalThis.fetch = (url: string | URL, _init?: RequestInit) => {
    const urlStr = url instanceof URL ? url.href : String(url);
    const result = handler(urlStr);
    if (result instanceof Promise) {
      return result.then((r) => r.clone());
    }
    return Promise.resolve(result.clone());
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
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
