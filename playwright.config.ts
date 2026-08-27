import { defineConfig, devices } from '@playwright/test'

import { E2E_PORT, prepareE2EServerEnvironment } from './scripts/e2e-server-environment.mjs'

try {
  process.loadEnvFile('.env')
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
}

const serverEnvironment = prepareE2EServerEnvironment(process.env)
const serverUrl = `http://127.0.0.1:${E2E_PORT}`

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  testDir: './tests/e2e',
  use: {
    baseURL: serverUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm start:e2e',
    env: serverEnvironment,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `${serverUrl}/health/live`,
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
