/**
 * Tiny wrapper around `localStorage` for the JWT access token.
 *
 * We intentionally keep this in one place so tests can swap the storage
 * backend (or an in-memory implementation) without changing any caller.
 *
 * NOTE: localStorage is appropriate for a take-home. A production CMS
 * would prefer HttpOnly cookies or an in-memory + refresh-token model so
 * the token is not readable from JavaScript.
 */

const KEY = 'peblo-cms:access_token';

export const tokenStorage = {
  get(): string | null {
    try {
      return window.localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    try {
      window.localStorage.setItem(KEY, token);
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};