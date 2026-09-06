/**
 * ProtectedRoute — gates `/app/*` on `status === 'authenticated'`.
 *
 *   status='loading'      → render <LoadingState /> (don't redirect yet;
 *                            the user might just be a slow /auth/me).
 *   status='unauthenticated' → <Navigate to="/login" replace />.
 *   status='authenticated' → <Outlet />.
 *
 * Frontend permission hiding is NOT security. The backend remains the
 * authoritative gate; this route only keeps the URL bar honest.
 */
import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { LoadingState } from '../components/LoadingState';

export function ProtectedRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingState label="Restoring session…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}