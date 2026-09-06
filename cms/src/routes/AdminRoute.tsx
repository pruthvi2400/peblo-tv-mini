/**
 * AdminRoute — gates admin-only areas.
 *
 *   status='loading'         → LoadingState.
 *   status='unauthenticated' → /login.
 *   authenticated (editor or admin) → <Outlet />.
 *
 * Note: The publish page (Outlet) itself handles role-based UI
 * (editors see validation report + history but NOT the publish button).
 * The backend also enforces admin-only at the API level.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { LoadingState } from '../components/LoadingState';

export function AdminRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingState label="Checking permissions…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
} 
