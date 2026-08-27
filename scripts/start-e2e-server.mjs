import { spawn } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveE2EServerEnvironment } from './e2e-server-environment.mjs'

export async function startE2EServer({
  environment = process.env,
  reset = resetDatabase,
  start = spawn,
} = {}) {
  const serverEnvironment = resolveE2EServerEnvironment(environment)
  const applicationEnvironment = { ...serverEnvironment }
  delete applicationEnvironment.E2E_DATABASE_URL
  delete applicationEnvironment.E2E_RUNTIME_DATABASE_URL

  await reset(serverEnvironment.DATABASE_URL)

  const server = start('pnpm', ['start'], {
    env: applicationEnvironment,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  const forwardSigint = () => server.kill('SIGINT')
  const forwardSigterm = () => server.kill('SIGTERM')
  process.once('SIGINT', forwardSigint)
  process.once('SIGTERM', forwardSigterm)

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject)
      server.once('exit', (code, signal) => {
        if (signal || code === 0) resolve()
        else reject(new Error(`E2E server exited with status ${code ?? 'unknown'}.`))
      })
    })
  } finally {
    process.removeListener('SIGINT', forwardSigint)
    process.removeListener('SIGTERM', forwardSigterm)
  }
}

async function resetDatabase(databaseUrl) {
  const { resetE2EDatabase } = await import('../apps/api/src/reset-e2e-database.ts')
  await resetE2EDatabase(databaseUrl)
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await startE2EServer()
}
