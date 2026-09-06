/**
 * AuthProvider — the React component that owns the AuthContext value.
 *
 * State machine:
 *
 *   status: 'loading'        — we have a token, fetching /auth/me
 *   status: 'authenticated' — user is known
 *   status: 'unauthenticated' — no token, or token rejected
 *
 * The bare `createContext` call lives in `./context` so this file
 * only exports the provider component (which keeps Vite React Refresh
 * happy).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { configureApi } from '../api/client';
import { getCurrentUser, login as loginRequest } from '../api/auth';
import { tokenStorage } from './tokenStorage';
import type { CurrentUser, LoginRequest } from '../types/api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './context';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStorage.get() ? 'loading' : 'unauthenticated',
  );
  const [user, setUser] = useState<CurrentUser | null>(null);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setStatus('unauthenticated');
    queryClient.clear();
  }, [queryClient]);

  // Wire the API client's 401 + bearer-token callbacks ONCE.
  useEffect(() => {
    configureApi({
      getToken: () => tokenStorage.get(),
      onUnauthorized: () => {
        tokenStorage.clear();
        setUser(null);
        setStatus('unauthenticated');
        queryClient.clear();
      },
    });
  }, [queryClient]);

  // If we restored a token from storage, validate it by loading /auth/me.
  useEffect(() => {
    if (status !== 'loading') return;
    const token = tokenStorage.get();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        // 401 etc. — the API client already cleared the token via the
        // onUnauthorized handler, so just flip our local state.
        setUser(null);
        setStatus('unauthenticated');
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  const login = useCallback(
    async (payload: LoginRequest) => {
      const res = await loginRequest(payload);
      tokenStorage.set(res.access_token);
      // Force-load the current user. The API client already has the
      // bearer-token getter wired to tokenStorage, so this fetch will
      // carry the new token automatically.
      const u = await getCurrentUser();
      setUser(u);
      setStatus('authenticated');
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin: user?.role === 'admin',
      login,
      logout,
    }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}