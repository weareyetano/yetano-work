import type { ProblemDetails } from '@yetano/contracts'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

import type { AppEnvironment } from './http-types.js'

export function problem(
  context: Context<AppEnvironment>,
  status: ContentfulStatusCode,
  title: string,
  detail?: string,
) {
  const body: ProblemDetails = {
    ...(detail ? { detail } : {}),
    instance: new URL(context.req.url).pathname,
    requestId: context.get('requestId'),
    status,
    title,
    type: 'about:blank',
  }

  return context.json(body, status, { 'Content-Type': 'application/problem+json' })
}
