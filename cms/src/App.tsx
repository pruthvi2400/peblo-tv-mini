/**
 * App root.
 *
 * Provider order matters:
 *   1. QueryClientProvider — TanStack Query context.
 *   2. AuthProvider        — owns the user, talks to the API client.
 *   3. Router              — BrowserRouter in production; tests inject
 *                            a MemoryRouter via `router` prop.
 *   4. AppRouter           — actual routes.
 *
 * The Router is injectable so tests can drive navigation deterministically
 * via MemoryRouter without the BrowserRouter double-render error.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ComponentType, ReactNode } from 'react';

import { AuthProvider } from './auth/AuthContext';
import { AppRouter } from './routes/AppRouter';
import { queryClient } from './queryClient';

export interface AppProps {
  /** Optional Router component override for tests. */
  router?: ComponentType<{ children?: ReactNode }>;
  /** Optional QueryClient override for tests. */
  client?: QueryClient;
}

export function App({ router: RouterImpl, client }: AppProps = {}) {
  const Router = RouterImpl ?? BrowserRouter;
  const qc = client ?? queryClient;
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Router>
          <AppRouter />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}