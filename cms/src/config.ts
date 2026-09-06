/**
 * Build-time configuration for the CMS.
 *
 * Vite injects `import.meta.env.VITE_*` variables at build time. Anything
 * NOT prefixed with `VITE_` is unavailable in the browser bundle for
 * safety, so configuration that needs to be visible to the React app
 * MUST be exposed via a `VITE_` env var.
 */

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

// Normalise: strip a trailing slash so callers can concatenate safely.
export const API_BASE_URL: string = rawBaseUrl.replace(/\/+$/, '');

/** Test-only override hook. Not used in production code. */
export const __TEST_API_BASE_URL__ = rawBaseUrl;