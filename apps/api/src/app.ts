import { serveStatic } from '@hono/node-server/serve-static'
import { RequestContext } from '@mikro-orm/core'
import { Scalar } from '@scalar/hono-api-reference'
import { asValue } from 'awilix'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { compress } from 'hono/compress'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { openAPIRouteHandler } from 'hono-openapi'

import type { AppContainer } from './container.js'
import { createRequestScope } from './container.js'
import type { AppEnvironment } from './http-types.js'
import { applicationModules } from './modules/index.js'
import {
  AuthenticationRequiredError,
  AuthorizationDeniedError,
} from './platform/execution/errors.js'
import { problem } from './problem.js'

interface CreateAppOptions {
  container?: AppContainer
}

export function createApp({ container }: CreateAppOptions = {}) {
  const app = new Hono<AppEnvironment>()

  app.use('*', requestId())
  app.use('*', secureHeaders())
  app.use('*', compress())
  app.use('/api/*', bodyLimit({ maxSize: 1024 * 1024 }))

  if (container) {
    app.use('*', async (context, next) => {
      const startedAt = performance.now()
      await next()
      container.resolve('logger').info('HTTP request completed', {
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        method: context.req.method,
        path: new URL(context.req.url).pathname,
        requestId: context.get('requestId'),
        status: context.res.status,
      })
    })
  }

  app.get('/health/live', (context) => context.json({ status: 'ok' as const }, 200))
  app.get('/health/ready', async (context) => {
    if (!container)
      return problem(context, 503, 'Service Unavailable', 'Runtime is not initialized.')

    try {
      await container.resolve('orm').em.getConnection().execute('select 1')
      return context.json({ status: 'ok' as const }, 200)
    } catch {
      return problem(context, 503, 'Service Unavailable', 'Database is not ready.')
    }
  })

  app.use('/api/v1/*', async (context, next) => {
    if (!container)
      return problem(context, 503, 'Service Unavailable', 'Runtime is not initialized.')

    const scope = createRequestScope(container)
    const entityManager = scope.resolve('entityManager')
    scope.register({
      logger: asValue(container.resolve('logger').child({ requestId: context.get('requestId') })),
    })
    context.set('scope', scope)

    return RequestContext.create(entityManager, next)
  })

  app.use('/api/v1/cases/*', async (context, next) => {
    try {
      const executionContext = await context
        .get('scope')
        .resolve('executionContextFactory')
        .create(context.req.raw, context.get('requestId'))
      context.set('executionContext', executionContext)
      await next()
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return problem(context, 401, 'Unauthorized', error.message)
      }
      if (error instanceof AuthorizationDeniedError) {
        return problem(context, 403, 'Forbidden', error.message)
      }
      throw error
    }
  })

  const apiRoutes = new Hono<AppEnvironment>()
  for (const module of applicationModules) apiRoutes.route('/api/v1', module.routes())
  app.route('/', apiRoutes)

  if (container?.resolve('config').nodeEnv !== 'production') {
    app.get(
      '/api/openapi.json',
      openAPIRouteHandler(apiRoutes, {
        documentation: {
          info: {
            description: 'Public API for Yetano Work.',
            title: 'Yetano Work API',
            version: '1.0.0',
          },
          openapi: '3.1.0',
        },
      }),
    )
    app.get('/api/docs', Scalar({ url: '/api/openapi.json' }))
  }

  app.all('/api/*', (context) => problem(context, 404, 'Not Found', 'API route not found.'))
  app.all('/health/*', (context) => problem(context, 404, 'Not Found', 'Health route not found.'))

  if (container) {
    const staticRoot = container.resolve('config').staticRoot
    app.use('/assets/*', async (context, next) => {
      await next()
      if (context.res.ok) {
        context.header('Cache-Control', 'public, max-age=31536000, immutable')
      }
    })
    app.use('*', serveStatic({ root: staticRoot }))
    app.get('*', async (context, next) => {
      context.header('Cache-Control', 'no-cache')
      return serveStatic({ path: 'index.html', root: staticRoot })(context, next)
    })
  }

  app.onError((error, context) => {
    container?.resolve('logger').error('Unhandled request error', {
      error: error instanceof Error ? error.message : String(error),
      requestId: context.get('requestId'),
    })
    return problem(context, 500, 'Internal Server Error', 'An unexpected error occurred.')
  })

  app.notFound((context) => problem(context, 404, 'Not Found', 'Resource not found.'))

  return app
}
