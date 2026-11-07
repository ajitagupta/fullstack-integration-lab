import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',        // use the fake-browser environment
    globals: true,               // so test/expect are available without importing
    setupFiles: './src/setup.ts', // for jest-dom matchers
    include: ['src/**/*.test.tsx']
  },
});

