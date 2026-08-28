import { serve } from '@hono/node-server'

import { createApp } from './app.js'
import { createRuntime, disposeRuntime } from './runtime.js'

const runtime = await createRuntime({ requireProtectedRuntime: true })
const app = createApp({ container: runtime.container })
const server = serve({ fetch: app.fetch, port: runtime.config.port })
runtime.container.resolve('outboxDispatcher').start()

runtime.logger.info('Yetano Work started', { port: runtime.config.port })

let shuttingDown = false
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return
  shuttingDown = true
  runtime.logger.info('Shutting down', { signal })

  server.close(async (error) => {
    if (error) runtime.logger.error('HTTP server shutdown failed', { error: error.message })
    let cleanupFailed = false
    try {
      await disposeRuntime(runtime)
    } catch (cleanupError) {
      cleanupFailed = true
      runtime.logger.error('Runtime shutdown failed', {
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      })
    }
    process.exitCode = error || cleanupFailed ? 1 : 0
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
