import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        '**/*.config.ts',
        '**/*.d.ts',
        '**/dist/**',
        '**/generated/**',
        '**/routeTree.gen.ts',
        '**/server.ts',
      ],
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    exclude: ['**/*.integration.test.ts', '**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    include: ['apps/**/*.test.{ts,tsx}', 'packages/**/*.test.ts'],
    passWithNoTests: false,
    setupFiles: ['./apps/web/src/test/setup.ts'],
  },
})
