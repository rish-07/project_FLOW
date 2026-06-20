import { defineConfig } from 'vitest/config';

// Plain node test runner for pure logic (no SvelteKit plugin needed). Keeps unit
// tests fast and free of $app/$env resolution. Tests import modules by relative
// path so no alias setup is required.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
