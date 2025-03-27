// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // for `describe`, `it`, `expect` etc.
    environment: 'node', // for Node.js environment
    include: ['test/**/*.test.ts'], // or .js
  },
});
