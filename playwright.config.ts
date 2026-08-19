import { defineConfig, devices } from '@playwright/test'

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://yetano:yetano@localhost:5432/yetano_work'

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm start',
    env: { DATABASE_URL: databaseUrl, NODE_ENV: 'test' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3000/health/live',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
