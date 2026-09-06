/**
 * Auth React context object — exported separately from the provider so
 * Vite's React Refresh Fast Refresh can detect only-component files.
 *
 *   import { AuthContext } from './auth/context';
 *   const ctx = useContext(AuthContext);
 */
import { createContext } from 'react';

import type { CurrentUser } from '../types/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  /** True iff the user object is loaded AND role === 'admin'. */
  isAdmin: boolean;
  login: (payload: { email: string; password: string }) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);