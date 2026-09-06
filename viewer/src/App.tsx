// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Layout } from './layouts/Layout';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { ShowDetailsPage } from './pages/ShowDetailsPage';

export interface AppProps {
  client?: QueryClient;
  initialRoute?: string;
}

export function App({ client, initialRoute }: AppProps = {}) {
  const qc = client ?? new QueryClient();

  const routerProps = initialRoute
    ? { initialEntries: [initialRoute] }
    : {};

  const Router = initialRoute ? MemoryRouter : BrowserRouter;

  return (
    <QueryClientProvider client={qc}>
      <Router {...routerProps}>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/shows/:slug" element={<ShowDetailsPage />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  );
}
