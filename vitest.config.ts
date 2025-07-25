import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    typecheck: {
      tsconfig: './test/tsconfig.json',
    },
    coverage: {
      include: ['src/**/*.ts'],
    },
  },
});
