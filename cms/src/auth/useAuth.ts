/**
 * Convenience hook for consuming the AuthContext.
 *
 * Throws when used outside an `<AuthProvider>` so misuse is caught
 * loudly in tests / dev.
 */
import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './context';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>.');
  }
  return ctx;
}