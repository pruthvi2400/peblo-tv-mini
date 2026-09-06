// @ts-expect-error React import required for ESLint react/react-in-jsx-scope rule
import React from 'react';

import { Route, Routes } from 'react-router-dom';
import { Layout } from '../layouts/Layout';
import { HomePage } from '../pages/HomePage';
import { SearchPage } from '../pages/SearchPage';
import { ShowDetailsPage } from '../pages/ShowDetailsPage';

export function AppRouter() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/shows/:slug" element={<ShowDetailsPage />} />
      </Routes>
    </Layout>
  );
}
