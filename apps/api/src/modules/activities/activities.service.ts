import { UniqueConstraintViolationException } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type {
  Activity,
  ActivityList,
  ActivityListQuery,
  CaseId,
  CreateActivityNoteRequest,
} from '@yetano/contracts'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationExecutor } from '../../platform/execution/operation.js'
import type { CasesReadPort } from '../cases/index.js'
import {
  type CreateActivityNoteResult,
  createActivityNoteOperation,
  listCaseActivitiesOperation,
} from './activities.operations.js'
import { ActivityEntity, type ActivityRecord } from './activity.entity.js'
import { type ActivityCursor, createActivityRepository } from './activity.repository.js'

export class ActivityCaseNotFoundError extends Error {}
export class ActivityIdConflictError extends Error {}
export class ActivityValidationError extends Error {}
export class InvalidActivityCursorError extends Error {}

export interface ActivitiesService {
  createNote(
    caseId: CaseId,
    request: CreateActivityNoteRequest,
    context: ExecutionContext,
  ): Promise<CreateActivityNoteResult>
  list(caseId: CaseId, request: ActivityListQuery, context: ExecutionContext): Promise<ActivityList>
}

export function createActivitiesService({
  casesReadPort,
  entityManager,
  operationExecutor,
}: {
  casesReadPort: CasesReadPort
  entityManager: EntityManager
  operationExecutor: OperationExecutor
}): ActivitiesService {
  return {
    async createNote(caseId, request, executionContext) {
      const normalizedRequest = {
        ...request,
        content: normalizeActivityContent(request.content),
      }
      try {
        return await operationExecutor.execute(
          createActivityNoteOperation,
          executionContext,
          { caseId, request: normalizedRequest },
          async (input, context) => {
            await requireCase(casesReadPort, executionContext, input.caseId)
            const repository = createActivityRepository(context.entityManager)
            const replay = await repository.findById(input.request.activityId)
            if (replay) {
              return {
                activity: resolveNoteReplay(replay, input.caseId, input.request, executionContext),
                created: false,
              }
            }
            const record = context.entityManager.create(ActivityEntity, {
              actorId: executionContext.actor.id,
              actorType: executionContext.actor.type,
              body: input.request.content,
              caseId: input.caseId,
              caseVersion: null,
              fromStatus: null,
              id: input.request.activityId,
              occurredAt: new Date(),
              organizationId: executionContext.organizationId,
              toStatus: null,
              type: 'note',
            })
            context.entityManager.persist(record)
            await context.entityManager.flush()
            return { activity: toActivity(record), created: true }
          },
        )
      } catch (error) {
        if (!isActivityIdConstraint(error)) throw error
        const replay = await createActivityRepository(entityManager).findById(request.activityId)
        if (!replay) throw error
        return {
          activity: resolveNoteReplay(replay, caseId, normalizedRequest, executionContext),
          created: false,
        }
      }
    },
    list(caseId, request, executionContext) {
      return operationExecutor.execute(
        listCaseActivitiesOperation,
        executionContext,
        { caseId, request },
        async (input, context) => {
          await requireCase(casesReadPort, executionContext, input.caseId)
          const limit = input.request.limit ?? 25
          const repository = createActivityRepository(context.entityManager)
          const result = await repository.list(executionContext.organizationId, input.caseId, {
            ...(input.request.cursor ? { cursor: decodeActivityCursor(input.request.cursor) } : {}),
            limit,
          })
          const last = result.items.at(-1)
          return {
            items: result.items.map(toActivity),
            nextCursor: result.hasMore && last ? encodeActivityCursor(last) : null,
          }
        },
      )
    },
  }
}

async function requireCase(
  casesReadPort: CasesReadPort,
  executionContext: ExecutionContext,
  caseId: CaseId,
) {
  const record = await casesReadPort.findById(executionContext.organizationId, caseId)
  if (!record) throw new ActivityCaseNotFoundError('Case not found.')
}

function normalizeActivityContent(content: string) {
  const normalized = content.trim()
  if (!normalized || normalized.length > 10_000) {
    throw new ActivityValidationError('Activity note content must contain 1 to 10000 characters.')
  }
  return normalized
}

function resolveNoteReplay(
  record: ActivityRecord,
  caseId: CaseId,
  request: CreateActivityNoteRequest,
  context: ExecutionContext,
) {
  if (
    record.organizationId !== context.organizationId ||
    record.caseId !== caseId ||
    record.type !== 'note' ||
    record.body !== request.content ||
    record.actorId !== context.actor.id ||
    record.actorType !== context.actor.type
  ) {
    throw new ActivityIdConflictError('The activity id has already been used for another note.')
  }
  return toActivity(record)
}

function isActivityIdConstraint(error: unknown): error is UniqueConstraintViolationException {
  return (
    error instanceof UniqueConstraintViolationException &&
    Reflect.get(error, 'constraint') === 'activities_pkey'
  )
}

export function toActivity(record: ActivityRecord): Activity {
  const common = {
    actorId: record.actorId,
    actorType: record.actorType,
    caseId: record.caseId,
    id: record.id,
    occurredAt: record.occurredAt.toISOString(),
  }
  if (record.type === 'note') {
    if (!record.body) throw new Error(`Activity ${record.id} has invalid note data.`)
    return { ...common, content: record.body, type: 'note' }
  }
  if (record.type === 'case_created') {
    if (!record.caseVersion) throw new Error(`Activity ${record.id} has invalid creation data.`)
    return { ...common, caseVersion: record.caseVersion, type: 'case_created' }
  }
  if (!record.caseVersion || !record.fromStatus || !record.toStatus) {
    throw new Error(`Activity ${record.id} has invalid status-change data.`)
  }
  return {
    ...common,
    caseVersion: record.caseVersion,
    fromStatus: record.fromStatus,
    note: record.body ?? null,
    toStatus: record.toStatus,
    type: 'case_status_changed',
  }
}

function encodeActivityCursor(record: Pick<ActivityRecord, 'id' | 'occurredAt'>) {
  return Buffer.from(
    JSON.stringify({ id: record.id, occurredAt: record.occurredAt.toISOString() }),
  ).toString('base64url')
}

function decodeActivityCursor(value: string): ActivityCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid cursor')
    const id = Reflect.get(parsed, 'id')
    const occurredAtValue = Reflect.get(parsed, 'occurredAt')
    const occurredAt = new Date(typeof occurredAtValue === 'string' ? occurredAtValue : '')
    if (
      Number.isNaN(occurredAt.valueOf()) ||
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new Error('Invalid cursor')
    }
    return { id, occurredAt }
  } catch {
    throw new InvalidActivityCursorError('Invalid activity cursor.')
  }
}
