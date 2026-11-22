import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',        // use the fake-browser environment
    globals: true,               // so test/expect are available without importing
    setupFiles: './src/setup.ts', // for jest-dom matchers
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/main.tsx", "src/setup.ts"],
    },
  },
});

