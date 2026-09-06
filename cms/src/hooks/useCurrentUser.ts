/**
 * useCurrentUser — a TanStack Query wrapper around GET /auth/me.
 *
 *  - Disabled when there is no token (no pointless 401).
 *  - `enabled` is also driven by `authStatus === 'authenticated'` so the
 *    CMS never fires a background refresh for an unknown user.
 */
import { useQuery } from '@tanstack/react-query';

import { getCurrentUser } from '../api/auth';
import { useAuth } from '../auth/useAuth';
import type { CurrentUser } from '../types/api';

export function useCurrentUser() {
  const { status } = useAuth();
  return useQuery<CurrentUser>({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    enabled: status === 'authenticated',
    // /auth/me is cheap and the source of truth; cache for 30s.
    staleTime: 30_000,
    retry: false,
  });
}