import { serve } from '@hono/node-server'

import { createApp } from './app.js'
import { createRuntime } from './runtime.js'

const runtime = await createRuntime()
const app = createApp({ container: runtime.container })
const server = serve({ fetch: app.fetch, port: runtime.config.port })

runtime.logger.info('Yetano Work started', { port: runtime.config.port })

let shuttingDown = false
const shutdown = (signal: NodeJS.Signals) => {
  if (shuttingDown) return
  shuttingDown = true
  runtime.logger.info('Shutting down', { signal })

  server.close(async (error) => {
    if (error) runtime.logger.error('HTTP server shutdown failed', { error: error.message })
    await runtime.orm.close(true)
    process.exitCode = error ? 1 : 0
  })
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
