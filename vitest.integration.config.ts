import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['apps/**/*.integration.test.ts'],
    testTimeout: 30_000,
  },
})
