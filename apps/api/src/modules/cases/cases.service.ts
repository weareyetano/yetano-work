import { randomUUID } from 'node:crypto'

import { OptimisticLockError } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type {
  Case,
  CaseId,
  CaseList,
  CreateCaseRequest,
  ListCasesQuery,
  TransitionCaseRequest,
  UpdateCaseRequest,
} from '@yetano/contracts'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationExecutor } from '../../platform/execution/operation.js'
import { CaseEntity, type CaseRecord } from './case.entity.js'
import { type CaseCursor, createCaseRepository } from './case.repository.js'
import {
  caseClosedEvent,
  caseCreatedEvent,
  caseReopenedEvent,
  caseUpdatedEvent,
} from './cases.events.js'
import {
  closeCaseOperation,
  createCaseOperation,
  getCaseOperation,
  listCasesOperation,
  reopenCaseOperation,
  updateCaseOperation,
} from './cases.operations.js'

export class CaseNotFoundError extends Error {}

export class CaseValidationError extends Error {}

export class CaseVersionConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super('The case changed since it was loaded.')
  }
}

export class InvalidCaseCursorError extends Error {}

export interface CasesService {
  close(caseId: CaseId, request: TransitionCaseRequest, context: ExecutionContext): Promise<Case>
  create(request: CreateCaseRequest, context: ExecutionContext): Promise<Case>
  get(caseId: CaseId, context: ExecutionContext): Promise<Case>
  list(request: ListCasesQuery, context: ExecutionContext): Promise<CaseList>
  reopen(caseId: CaseId, request: TransitionCaseRequest, context: ExecutionContext): Promise<Case>
  update(caseId: CaseId, request: UpdateCaseRequest, context: ExecutionContext): Promise<Case>
}

export function createCasesService({
  entityManager,
  operationExecutor,
}: {
  entityManager: EntityManager
  operationExecutor: OperationExecutor
}): CasesService {
  return {
    close(caseId, request, executionContext) {
      return executeWithOptimisticConflict(
        () =>
          operationExecutor.execute(
            closeCaseOperation,
            executionContext,
            { caseId, request },
            async (input, context) => {
              const repository = createCaseRepository(context.entityManager)
              const record = await requireCase(
                repository,
                context.executionContext.organizationId,
                caseId,
              )
              if (record.status === 'closed') return toCase(record)
              assertVersion(record, input.request.expectedVersion)
              const now = new Date()
              record.status = 'closed'
              record.closedAt = now
              record.updatedAt = now
              await context.entityManager.flush()
              context.emit({
                aggregateId: record.id,
                aggregateVersion: record.version,
                definition: caseClosedEvent,
                payload: { caseId: record.id, caseVersion: record.version },
              })
              return toCase(record)
            },
          ),
        () =>
          resolveTransitionConflict(
            entityManager,
            executionContext.organizationId,
            caseId,
            'closed',
          ),
      )
    },
    create(request, executionContext) {
      return operationExecutor.execute(
        createCaseOperation,
        executionContext,
        request,
        async (input, context) => {
          const now = new Date()
          const record = context.entityManager.create(CaseEntity, {
            closedAt: null,
            createdAt: now,
            customerId: input.customerId ?? null,
            description: normalizeDescription(input.description),
            id: randomUUID() as CaseId,
            organizationId: context.executionContext.organizationId,
            status: 'open',
            title: normalizeTitle(input.title),
            updatedAt: now,
            version: 1,
          })
          context.entityManager.persist(record)
          await context.entityManager.flush()
          context.emit({
            aggregateId: record.id,
            aggregateVersion: record.version,
            definition: caseCreatedEvent,
            payload: { caseId: record.id, caseVersion: record.version },
          })
          return toCase(record)
        },
      )
    },
    get(caseId, executionContext) {
      return operationExecutor.execute(
        getCaseOperation,
        executionContext,
        caseId,
        async (id, context) => {
          const repository = createCaseRepository(context.entityManager)
          return toCase(await requireCase(repository, context.executionContext.organizationId, id))
        },
      )
    },
    list(request, executionContext) {
      return operationExecutor.execute(
        listCasesOperation,
        executionContext,
        request,
        async (input, context) => {
          const limit = input.limit ?? 25
          const repository = createCaseRepository(context.entityManager)
          const result = await repository.list(context.executionContext.organizationId, {
            ...(input.cursor ? { cursor: decodeCursor(input.cursor) } : {}),
            ...(input.customerId ? { customerId: input.customerId } : {}),
            limit,
            ...(input.status ? { status: input.status } : {}),
          })
          const last = result.items.at(-1)
          return {
            items: result.items.map(toCase),
            nextCursor: result.hasMore && last ? encodeCursor(last) : null,
          }
        },
      )
    },
    reopen(caseId, request, executionContext) {
      return executeWithOptimisticConflict(
        () =>
          operationExecutor.execute(
            reopenCaseOperation,
            executionContext,
            { caseId, request },
            async (input, context) => {
              const repository = createCaseRepository(context.entityManager)
              const record = await requireCase(
                repository,
                context.executionContext.organizationId,
                caseId,
              )
              if (record.status === 'open') return toCase(record)
              assertVersion(record, input.request.expectedVersion)
              record.status = 'open'
              record.closedAt = null
              record.updatedAt = new Date()
              await context.entityManager.flush()
              context.emit({
                aggregateId: record.id,
                aggregateVersion: record.version,
                definition: caseReopenedEvent,
                payload: { caseId: record.id, caseVersion: record.version },
              })
              return toCase(record)
            },
          ),
        () =>
          resolveTransitionConflict(entityManager, executionContext.organizationId, caseId, 'open'),
      )
    },
    update(caseId, request, executionContext) {
      return executeWithOptimisticConflict(
        () =>
          operationExecutor.execute(
            updateCaseOperation,
            executionContext,
            { caseId, request },
            async (input, context) => {
              const repository = createCaseRepository(context.entityManager)
              const record = await requireCase(
                repository,
                context.executionContext.organizationId,
                caseId,
              )
              assertVersion(record, input.request.expectedVersion)
              const changedFields: Array<'customerId' | 'description' | 'title'> = []

              if ('title' in input.request) {
                const title = normalizeTitle(input.request.title as string)
                if (record.title !== title) {
                  record.title = title
                  changedFields.push('title')
                }
              }
              if ('description' in input.request) {
                const description = normalizeDescription(input.request.description)
                if (record.description !== description) {
                  record.description = description
                  changedFields.push('description')
                }
              }
              if ('customerId' in input.request && record.customerId !== input.request.customerId) {
                record.customerId = input.request.customerId ?? null
                changedFields.push('customerId')
              }

              if (changedFields.length === 0) return toCase(record)
              record.updatedAt = new Date()
              await context.entityManager.flush()
              context.emit({
                aggregateId: record.id,
                aggregateVersion: record.version,
                definition: caseUpdatedEvent,
                payload: { caseId: record.id, caseVersion: record.version, changedFields },
              })
              return toCase(record)
            },
          ),
        () => rejectWithCurrentVersion(entityManager, executionContext.organizationId, caseId),
      )
    },
  }
}

async function requireCase(
  repository: ReturnType<typeof createCaseRepository>,
  organizationId: ExecutionContext['organizationId'],
  caseId: CaseId,
) {
  const record = await repository.findById(organizationId, caseId)
  if (!record) throw new CaseNotFoundError('Case not found.')
  return record
}

function assertVersion(record: CaseRecord, expectedVersion: number) {
  if (record.version !== expectedVersion) throw new CaseVersionConflictError(record.version)
}

async function executeWithOptimisticConflict<Result>(
  run: () => Promise<Result>,
  resolveConflict: () => Promise<Result>,
): Promise<Result> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof OptimisticLockError) {
      return resolveConflict()
    }
    throw error
  }
}

async function resolveTransitionConflict(
  entityManager: EntityManager,
  organizationId: ExecutionContext['organizationId'],
  caseId: CaseId,
  targetStatus: CaseRecord['status'],
): Promise<Case> {
  const record = await readCurrentCase(entityManager, organizationId, caseId)
  if (record.status === targetStatus) return toCase(record)
  throw new CaseVersionConflictError(record.version)
}

async function rejectWithCurrentVersion(
  entityManager: EntityManager,
  organizationId: ExecutionContext['organizationId'],
  caseId: CaseId,
): Promise<never> {
  throw new CaseVersionConflictError(
    await readCurrentVersion(entityManager, organizationId, caseId),
  )
}

async function readCurrentVersion(
  entityManager: EntityManager,
  organizationId: ExecutionContext['organizationId'],
  caseId: CaseId,
) {
  const record = await entityManager.findOne(
    CaseEntity,
    { id: caseId, organizationId },
    { fields: ['version'], refresh: true },
  )
  if (!record) throw new CaseNotFoundError('Case not found.')
  return record.version
}

async function readCurrentCase(
  entityManager: EntityManager,
  organizationId: ExecutionContext['organizationId'],
  caseId: CaseId,
) {
  const record = await entityManager.findOne(
    CaseEntity,
    { id: caseId, organizationId },
    { refresh: true },
  )
  if (!record) throw new CaseNotFoundError('Case not found.')
  return record
}

function normalizeTitle(value: string) {
  const title = value.trim()
  if (!title) throw new CaseValidationError('Title cannot be blank.')
  return title
}

function normalizeDescription(value: string | null | undefined) {
  if (value == null) return null
  const description = value.trim()
  return description || null
}

function toCase(record: CaseRecord): Case {
  return {
    closedAt: record.closedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    customerId: record.customerId ?? null,
    description: record.description ?? null,
    id: record.id,
    organizationId: record.organizationId,
    status: record.status,
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
    version: record.version,
  }
}

function encodeCursor(record: Pick<CaseRecord, 'createdAt' | 'id'>) {
  return Buffer.from(
    JSON.stringify({ createdAt: record.createdAt.toISOString(), id: record.id }),
  ).toString('base64url')
}

function decodeCursor(value: string): CaseCursor {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid cursor')
    const createdAtValue = Reflect.get(parsed, 'createdAt')
    const id = Reflect.get(parsed, 'id')
    const createdAt = new Date(typeof createdAtValue === 'string' ? createdAtValue : '')
    if (
      Number.isNaN(createdAt.valueOf()) ||
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new Error('Invalid cursor')
    }
    return { createdAt, id: id as CaseId }
  } catch {
    throw new InvalidCaseCursorError('Invalid case cursor.')
  }
}
