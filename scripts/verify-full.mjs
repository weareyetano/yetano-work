import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { resolveTestDatabaseEnvironment } from './test-database.mjs'

const gates = [
  ['lint', 'lint'],
  ['agent assets', 'agents:check'],
  ['typecheck', 'typecheck'],
  ['unit tests', 'test'],
  ['integration tests', 'test:integration'],
  ['generated API', 'api:check'],
  ['module catalog', 'modules:check'],
  ['build', 'build'],
  ['end-to-end tests', 'test:e2e'],
]

export function runFullVerification({
  environment = process.env,
  error = console.error,
  log = console.log,
  run = spawnSync,
} = {}) {
  try {
    resolveTestDatabaseEnvironment(environment)
  } catch (configurationError) {
    error(`Full verification NOT RUN: ${configurationError.message}`)
    return 2
  }

  for (const [label, script] of gates) {
    log(`\n[verify:full] ${label}`)
    const result = run('pnpm', [script], {
      env: environment,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })

    if (result.error) {
      error(`[verify:full] FAIL ${label}: ${result.error.message}`)
      return 1
    }
    if (result.status !== 0) {
      error(`[verify:full] FAIL ${label} (exit ${result.status ?? 'unknown'})`)
      return result.status ?? 1
    }

    log(`[verify:full] PASS ${label}`)
  }

  log('\n[verify:full] PASS all required gates')
  return 0
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = runFullVerification()
}
