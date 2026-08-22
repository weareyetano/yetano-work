import { HealthResponseSchema, ProblemDetailsSchema } from '@yetano/contracts'
import { Hono } from 'hono'
import { describeRoute } from 'hono-openapi'

import type { AppEnvironment } from '../../http-types.js'
import { problem } from '../../problem.js'

export function createHealthRoutes() {
  return new Hono<AppEnvironment>().get(
    '',
    describeRoute({
      description: 'Checks whether the API can reach its PostgreSQL database.',
      operationId: 'getHealth',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: HealthResponseSchema,
            },
          },
          description: 'The API and database are ready.',
        },
        503: {
          content: {
            'application/problem+json': {
              schema: ProblemDetailsSchema,
            },
          },
          description: 'The API is not ready.',
        },
      },
      tags: ['System'],
    }),
    async (context) => {
      try {
        const response = await context.get('scope').resolve('healthService').check()
        return context.json(response, 200)
      } catch {
        return problem(context, 503, 'Service Unavailable', 'Database is not ready.')
      }
    },
  )
}
