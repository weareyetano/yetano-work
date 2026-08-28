import {
  ActivityCursorSchema,
  ActivityIdConflictSchema,
  ActivityListLimitSchema,
  type ActivityListQuery,
  ActivityListQuerySchema,
  ActivityListSchema,
  type CaseId,
  CaseIdSchema,
  type CasePathParameters,
  CasePathParametersSchema,
  type CreateActivityNoteRequest,
  CreateActivityNoteRequestSchema,
  NoteActivitySchema,
  ProblemDetailsSchema,
} from '@yetano/contracts'
import { type Context, Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import type { TSchema } from 'typebox'
import { Compile } from 'typebox/compile'

import type { AppEnvironment } from '../../http-types.js'
import { problem } from '../../problem.js'
import { resolveActivitiesRegistration } from './activities.registrations.js'
import {
  ActivityCaseNotFoundError,
  ActivityIdConflictError,
  ActivityValidationError,
  InvalidActivityCursorError,
} from './activities.service.js'

const activityPathValidator = Compile(CasePathParametersSchema)
const activityListValidator = Compile(ActivityListQuerySchema)
const createNoteValidator = Compile(CreateActivityNoteRequestSchema)

const errorResponses = {
  400: problemResponse('The request is invalid.'),
  401: problemResponse('Authentication is required.'),
  403: problemResponse('The actor lacks a required capability.'),
  404: problemResponse('The case does not exist in the active organization.'),
}

export function createActivitiesRoutes() {
  const routes = new Hono<AppEnvironment>()

  routes.get(
    '/cases/:caseId',
    describeRoute({
      description: 'Lists immutable activities for one organization-scoped case.',
      operationId: 'listCaseActivities',
      parameters: [
        pathParameter('caseId'),
        queryParameter('cursor', ActivityCursorSchema),
        queryParameter('limit', ActivityListLimitSchema),
      ],
      responses: {
        ...errorResponses,
        200: jsonResponse(ActivityListSchema, 'A cursor-paginated case activity timeline.'),
      },
      tags: ['Activities'],
    }),
    async (context) => {
      const caseId = readCaseId(context)
      const query = parseListQuery(context)
      if (!caseId || !query || !activityListValidator.Check(query)) return invalidRequest(context)
      return runActivityAction(context, async () =>
        context.json(
          await resolveActivitiesService(context).list(
            caseId,
            query as ActivityListQuery,
            context.get('executionContext'),
          ),
          200,
        ),
      )
    },
  )

  routes.post(
    '/cases/:caseId/notes',
    describeRoute({
      description: 'Idempotently appends a user-authored note to a case activity timeline.',
      operationId: 'createActivityNote',
      parameters: [pathParameter('caseId')],
      requestBody: {
        content: { 'application/json': { schema: CreateActivityNoteRequestSchema } },
        required: true,
      },
      responses: {
        ...errorResponses,
        200: jsonResponse(NoteActivitySchema, 'The previously stored activity note.'),
        201: jsonResponse(NoteActivitySchema, 'The created activity note.'),
        409: {
          content: { 'application/problem+json': { schema: ActivityIdConflictSchema } },
          description: 'The activity id has already been used for another note.',
        },
      },
      tags: ['Activities'],
    }),
    async (context) => {
      const caseId = readCaseId(context)
      const request = await readJson(context, createNoteValidator)
      if (!caseId || !request) return invalidRequest(context)
      return runActivityAction(context, async () => {
        const result = await resolveActivitiesService(context).createNote(
          caseId,
          request as CreateActivityNoteRequest,
          context.get('executionContext'),
        )
        return context.json(result.activity, result.created ? 201 : 200)
      })
    },
  )

  return routes
}

function resolveActivitiesService(context: Context<AppEnvironment>) {
  return resolveActivitiesRegistration(context.get('scope'), 'activitiesService')
}

async function runActivityAction<ResponseType extends Response>(
  context: Context<AppEnvironment>,
  action: () => Promise<ResponseType>,
): Promise<ResponseType | Response> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof ActivityCaseNotFoundError) {
      return problem(context, 404, 'Not Found', error.message)
    }
    if (error instanceof ActivityValidationError || error instanceof InvalidActivityCursorError) {
      return problem(context, 400, 'Bad Request', error.message)
    }
    if (error instanceof ActivityIdConflictError) {
      return context.json(
        {
          code: 'activity_id_conflict' as const,
          detail: error.message,
          instance: new URL(context.req.url).pathname,
          requestId: context.get('requestId'),
          status: 409 as const,
          title: 'Conflict',
          type: 'about:blank',
        },
        409,
        { 'Content-Type': 'application/problem+json' },
      )
    }
    throw error
  }
}

async function readJson(
  context: { req: { json(): Promise<unknown> } },
  validator: { Check(value: unknown): boolean },
) {
  try {
    const value = await context.req.json()
    return validator.Check(value) ? value : null
  } catch {
    return null
  }
}

function readCaseId(context: { req: { param(name: string): string } }): CaseId | null {
  const value = { caseId: context.req.param('caseId') }
  return activityPathValidator.Check(value) ? (value as CasePathParameters).caseId : null
}

function parseListQuery(context: {
  req: { query(name: string): string | undefined }
}): Record<string, unknown> | null {
  const limitValue = context.req.query('limit')
  if (limitValue && !/^\d+$/.test(limitValue)) return null
  return {
    ...(context.req.query('cursor') ? { cursor: context.req.query('cursor') } : {}),
    ...(limitValue ? { limit: Number(limitValue) } : {}),
  }
}

function invalidRequest(context: Parameters<typeof problem>[0]) {
  return problem(context, 400, 'Bad Request', 'Request validation failed.')
}

function jsonResponse(schema: object, description: string) {
  return { content: { 'application/json': { schema } }, description }
}

function problemResponse(description: string) {
  return {
    content: { 'application/problem+json': { schema: ProblemDetailsSchema } },
    description,
  }
}

function pathParameter(name: string) {
  return { in: 'path' as const, name, required: true, schema: CaseIdSchema }
}

function queryParameter(name: string, schema: TSchema) {
  return { in: 'query' as const, name, required: false, schema }
}
