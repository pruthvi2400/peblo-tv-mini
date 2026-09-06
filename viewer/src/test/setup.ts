/**
 * Vitest global setup.
 *
 * Registers @testing-library/jest-dom matchers (toBeInTheDocument
 * etc.) and stubs window.matchMedia so tests run in jsdom without
 * pulling in extra polyfills.
 */
import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
