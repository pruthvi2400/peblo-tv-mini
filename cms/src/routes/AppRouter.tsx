/**
 * Top-level router.
 *
 * Public:
 *   /login
 *
 * Protected (editor + admin):
 *   /app                  → /app/shows
 *   /app/shows            → list
 *   /app/shows/new        → create form
 *   /app/shows/:showId    → detail (seasons + episodes)
 *   /app/shows/:showId/edit → edit form
 *
 * Admin-only:
 *   /app/publish          → publish placeholder
 *
 * Catch-all:
 *   *                     → NotFoundPage
 */
import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { CmsLayout } from '../layouts/CmsLayout';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PublishPage } from '../pages/PublishPage';
import { ShowDetailPage } from '../pages/shows/ShowDetailPage';
import { ShowFormPage } from '../pages/shows/ShowFormPage';
import { ShowsPage } from '../pages/ShowsPage';
import { AdminRoute } from './AdminRoute';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/shows" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<CmsLayout />}>
          <Route index element={<Navigate to="shows" replace />} />
          <Route path="shows" element={<ShowsPage />} />
          <Route path="shows/new" element={<ShowFormPage />} />
          <Route path="shows/:showId" element={<ShowDetailPage />} />
          <Route path="shows/:showId/edit" element={<ShowFormPage />} />

          <Route element={<AdminRoute />}>
            <Route path="publish" element={<PublishPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}