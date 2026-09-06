import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite + Vitest configuration for the Peblo TV Viewer.
//
// Single Vite project for the React app and its tests. The Vitest
// `environment: 'jsdom'` block below is what makes the test runner
// load `*.test.tsx` files using a browser-like DOM.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
