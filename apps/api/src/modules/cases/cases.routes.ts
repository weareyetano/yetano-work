import {
  CaseCursorSchema,
  type CaseId,
  CaseIdSchema,
  CaseListLimitSchema,
  CaseListSchema,
  type CasePathParameters,
  CasePathParametersSchema,
  CaseSchema,
  CaseSearchFilterSchema,
  CaseStatusChangeSchema,
  CaseStatusFilterSchema,
  CaseStatusGroupSchema,
  type CaseStatusHistoryQuery,
  CaseStatusHistoryQuerySchema,
  CaseStatusHistorySchema,
  CaseTransitionIdConflictSchema,
  CaseVersionConflictSchema,
  type ChangeCaseStatusRequest,
  ChangeCaseStatusRequestSchema,
  type CreateCaseRequest,
  CreateCaseRequestSchema,
  CustomerIdSchema,
  type ListCasesQuery,
  ListCasesQuerySchema,
  ProblemDetailsSchema,
  type UpdateCaseRequest,
  UpdateCaseRequestSchema,
} from '@yetano/contracts'
import { type Context, Hono } from 'hono'
import { describeRoute } from 'hono-openapi'
import Type, { type TSchema } from 'typebox'
import { Compile } from 'typebox/compile'

import type { AppEnvironment } from '../../http-types.js'
import { problem } from '../../problem.js'
import {
  CaseNotFoundError,
  CaseTransitionIdConflictError,
  CaseValidationError,
  CaseVersionConflictError,
  InvalidCaseCursorError,
} from './cases.service.js'

const casePathValidator = Compile(CasePathParametersSchema)
const createCaseValidator = Compile(CreateCaseRequestSchema)
const updateCaseValidator = Compile(UpdateCaseRequestSchema)
const transitionCaseValidator = Compile(ChangeCaseStatusRequestSchema)
const listCasesValidator = Compile(ListCasesQuerySchema)
const statusHistoryValidator = Compile(CaseStatusHistoryQuerySchema)

const errorResponses = {
  400: problemResponse('The request is invalid.'),
  401: problemResponse('Authentication is required.'),
  403: problemResponse('The actor lacks a required capability.'),
}

export function createCasesRoutes() {
  const routes = new Hono<AppEnvironment>()

  routes.post(
    '',
    describeRoute({
      description: 'Creates a new case in the server-resolved organization.',
      operationId: 'createCase',
      requestBody: {
        content: { 'application/json': { schema: CreateCaseRequestSchema } },
        required: true,
      },
      responses: {
        ...errorResponses,
        201: jsonResponse(CaseSchema, 'The created case.'),
      },
      tags: ['Cases'],
    }),
    async (context) => {
      const request = await readJson(context, createCaseValidator)
      if (!request) return invalidRequest(context)
      return runCaseAction(context, async () => {
        const value = await context
          .get('scope')
          .resolve('casesService')
          .create(request as CreateCaseRequest, context.get('executionContext'))
        context.header('Location', `/api/v1/cases/${value.id}`)
        return context.json(value, 201)
      })
    },
  )

  routes.get(
    '',
    describeRoute({
      description: 'Lists cases in the server-resolved organization.',
      operationId: 'listCases',
      parameters: [
        queryParameter('cursor', CaseCursorSchema),
        queryParameter('customerId', CustomerIdSchema),
        queryParameter('limit', CaseListLimitSchema),
        queryParameter('search', CaseSearchFilterSchema),
        {
          explode: true,
          in: 'query' as const,
          name: 'status',
          required: false,
          schema: CaseStatusFilterSchema,
          style: 'form' as const,
        },
        queryParameter('statusGroup', CaseStatusGroupSchema),
      ],
      responses: {
        ...errorResponses,
        200: jsonResponse(CaseListSchema, 'A cursor-paginated case list.'),
      },
      tags: ['Cases'],
    }),
    async (context) => {
      const query = parseListQuery(context)
      if (!query || !listCasesValidator.Check(query)) return invalidRequest(context)
      return runCaseAction(context, async () =>
        context.json(
          await context
            .get('scope')
            .resolve('casesService')
            .list(query as ListCasesQuery, context.get('executionContext')),
          200,
        ),
      )
    },
  )

  routes.get(
    '/:caseId/status-history',
    describeRoute({
      description: 'Lists immutable status history for one organization-scoped case.',
      operationId: 'listCaseStatusHistory',
      parameters: [
        pathParameter('caseId'),
        queryParameter('cursor', CaseCursorSchema),
        queryParameter('limit', CaseListLimitSchema),
      ],
      responses: {
        ...errorResponses,
        200: jsonResponse(CaseStatusHistorySchema, 'A cursor-paginated case status history.'),
        404: problemResponse('The case does not exist in the active organization.'),
      },
      tags: ['Cases'],
    }),
    async (context) => {
      const caseId = readCaseId(context)
      const query = parseHistoryQuery(context)
      if (!caseId || !query || !statusHistoryValidator.Check(query)) return invalidRequest(context)
      return runCaseAction(context, async () =>
        context.json(
          await context
            .get('scope')
            .resolve('casesService')
            .history(caseId, query as CaseStatusHistoryQuery, context.get('executionContext')),
          200,
        ),
      )
    },
  )

  routes.get(
    '/:caseId',
    describeRoute({
      description: 'Gets one organization-scoped case.',
      operationId: 'getCase',
      parameters: [pathParameter('caseId')],
      responses: {
        ...errorResponses,
        200: jsonResponse(CaseSchema, 'The requested case.'),
        404: problemResponse('The case does not exist in the active organization.'),
      },
      tags: ['Cases'],
    }),
    async (context) => {
      const caseId = readCaseId(context)
      if (!caseId) return invalidRequest(context)
      return runCaseAction(context, async () =>
        context.json(
          await context
            .get('scope')
            .resolve('casesService')
            .get(caseId, context.get('executionContext')),
          200,
        ),
      )
    },
  )

  routes.patch(
    '/:caseId',
    describeRoute({
      description: 'Updates editable case fields using optimistic concurrency.',
      operationId: 'updateCase',
      parameters: [pathParameter('caseId')],
      requestBody: {
        content: { 'application/json': { schema: UpdateCaseRequestSchema } },
        required: true,
      },
      responses: mutationResponses(CaseSchema, 'The updated case.'),
      tags: ['Cases'],
    }),
    async (context) => {
      const caseId = readCaseId(context)
      const request = await readJson(context, updateCaseValidator)
      if (!caseId || !request) return invalidRequest(context)
      return runCaseAction(context, async () =>
        context.json(
          await context
            .get('scope')
            .resolve('casesService')
            .update(caseId, request as UpdateCaseRequest, context.get('executionContext')),
          200,
        ),
      )
    },
  )

  routes.post(
    '/:caseId/transition',
    describeRoute({
      description: 'Transitions a case status idempotently using a client-generated command id.',
      operationId: 'transitionCase',
      parameters: [pathParameter('caseId')],
      requestBody: {
        content: { 'application/json': { schema: ChangeCaseStatusRequestSchema } },
        required: true,
      },
      responses: transitionResponses(),
      tags: ['Cases'],
    }),
    async (context) => {
      const caseId = readCaseId(context)
      const request = await readJson(context, transitionCaseValidator)
      if (!caseId || !request) return invalidRequest(context)
      return runCaseAction(context, async () =>
        context.json(
          await context
            .get('scope')
            .resolve('casesService')
            .transition(
              caseId,
              request as ChangeCaseStatusRequest,
              context.get('executionContext'),
            ),
          200,
        ),
      )
    },
  )

  return routes
}

async function runCaseAction<ResponseType extends Response>(
  context: Context<AppEnvironment>,
  action: () => Promise<ResponseType>,
): Promise<ResponseType | Response> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof CaseNotFoundError) {
      return problem(context, 404, 'Not Found', error.message)
    }
    if (error instanceof CaseValidationError || error instanceof InvalidCaseCursorError) {
      return problem(context, 400, 'Bad Request', error.message)
    }
    if (error instanceof CaseVersionConflictError) {
      return context.json(
        {
          code: 'case_version_conflict' as const,
          currentVersion: error.currentVersion,
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
    if (error instanceof CaseTransitionIdConflictError) {
      return context.json(
        {
          code: 'case_transition_id_conflict' as const,
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
  return casePathValidator.Check(value) ? (value as CasePathParameters).caseId : null
}

function parseListQuery(context: {
  req: {
    queries(name: string): string[] | undefined
    query(name: string): string | undefined
  }
}): Record<string, unknown> | null {
  const limitValue = context.req.query('limit')
  if (limitValue && !/^\d+$/.test(limitValue)) return null
  const searchValue = context.req.query('search')
  const statuses = context.req.queries('status')
  return {
    ...(context.req.query('cursor') ? { cursor: context.req.query('cursor') } : {}),
    ...(context.req.query('customerId') ? { customerId: context.req.query('customerId') } : {}),
    ...(limitValue ? { limit: Number(limitValue) } : {}),
    ...(searchValue !== undefined ? { search: searchValue } : {}),
    ...(statuses ? { status: statuses } : {}),
    ...(context.req.query('statusGroup') ? { statusGroup: context.req.query('statusGroup') } : {}),
  }
}

function parseHistoryQuery(context: {
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

function mutationResponses(schema: object, successDescription: string) {
  return {
    ...errorResponses,
    200: jsonResponse(schema, successDescription),
    404: problemResponse('The case does not exist in the active organization.'),
    409: {
      content: { 'application/problem+json': { schema: CaseVersionConflictSchema } },
      description: 'The expected case version is stale.',
    },
  }
}

function transitionResponses() {
  return {
    ...errorResponses,
    200: jsonResponse(CaseStatusChangeSchema, 'The stored case status transition.'),
    404: problemResponse('The case does not exist in the active organization.'),
    409: {
      content: {
        'application/problem+json': {
          schema: Type.Union([CaseTransitionIdConflictSchema, CaseVersionConflictSchema]),
        },
      },
      description: 'The case version is stale or the transition id has already been reused.',
    },
  }
}

function pathParameter(name: string) {
  return { in: 'path' as const, name, required: true, schema: CaseIdSchema }
}

function queryParameter(name: string, schema: TSchema) {
  return { in: 'query' as const, name, required: false, schema }
}
