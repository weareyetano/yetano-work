import { randomUUID } from 'node:crypto'

import { OptimisticLockError, UniqueConstraintViolationException } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import type {
  Case,
  CaseId,
  CaseList,
  CaseStatus,
  CaseStatusChange,
  ChangeCaseStatusRequest,
  CreateCaseRequest,
  ListCasesQuery,
  UpdateCaseRequest,
} from '@yetano/contracts'

import type { ExecutionContext } from '../../platform/execution/context.js'
import type { OperationDefinition, OperationExecutor } from '../../platform/execution/operation.js'
import { CaseEntity, type CaseRecord } from './case.entity.js'
import { type CaseCursor, createCaseRepository } from './case.repository.js'
import { CaseStatusChangeEntity, type CaseStatusChangeRecord } from './case-status-change.entity.js'
import { createCaseStatusChangeRepository } from './case-status-change.repository.js'
import { caseCreatedEvent, caseTransitionedEvent, caseUpdatedEvent } from './cases.events.js'
import {
  type CaseMutationInput,
  closeCaseOperation,
  createCaseOperation,
  getCaseOperation,
  listCasesOperation,
  reopenCaseOperation,
  transitionCaseOperation,
  updateCaseOperation,
} from './cases.operations.js'
import {
  assertCaseListQuery,
  CaseValidationError,
  normalizeCaseDescription,
  normalizeCaseTitle,
  normalizeCaseTransition,
} from './cases.policy.js'

export class CaseNotFoundError extends Error {}

export { CaseValidationError } from './cases.policy.js'

export class CaseVersionConflictError extends Error {
  constructor(readonly currentVersion: number) {
    super('The case changed since it was loaded.')
  }
}

export class CaseTransitionIdConflictError extends Error {}

export class InvalidCaseCursorError extends Error {}

export interface CasesService {
  create(request: CreateCaseRequest, context: ExecutionContext): Promise<Case>
  get(caseId: CaseId, context: ExecutionContext): Promise<Case>
  list(request: ListCasesQuery, context: ExecutionContext): Promise<CaseList>
  transition(
    caseId: CaseId,
    request: ChangeCaseStatusRequest,
    context: ExecutionContext,
  ): Promise<CaseStatusChange>
  update(caseId: CaseId, request: UpdateCaseRequest, context: ExecutionContext): Promise<Case>
}

type TransitionOperation = OperationDefinition<
  CaseMutationInput<ChangeCaseStatusRequest>,
  CaseStatusChange
>

export function createCasesService({
  entityManager,
  operationExecutor,
}: {
  entityManager: EntityManager
  operationExecutor: OperationExecutor
}): CasesService {
  return {
    create(request, executionContext) {
      const normalizedRequest: CreateCaseRequest = {
        ...request,
        description: normalizeCaseDescription(request.description),
        title: normalizeCaseTitle(request.title),
      }
      return operationExecutor.execute(
        createCaseOperation,
        executionContext,
        normalizedRequest,
        async (input, context) => {
          const now = new Date()
          const caseId = randomUUID() as CaseId
          const record = context.entityManager.create(CaseEntity, {
            closedAt: null,
            createdAt: now,
            customerId: input.customerId ?? null,
            description: input.description ?? null,
            id: caseId,
            organizationId: context.executionContext.organizationId,
            status: 'new',
            statusNote: null,
            title: input.title,
            updatedAt: now,
            version: 1,
          })
          context.entityManager.persist(record)
          await context.entityManager.flush()
          const history = context.entityManager.create(CaseStatusChangeEntity, {
            actorId: context.executionContext.actor.id,
            actorType: context.executionContext.actor.type,
            caseId,
            caseVersion: 1,
            changedAt: now,
            expectedVersion: null,
            fromStatus: null,
            id: randomUUID(),
            note: null,
            organizationId: context.executionContext.organizationId,
            source: 'runtime',
            toStatus: 'new',
            transitionId: null,
            type: 'created',
          })
          context.entityManager.persist(history)
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
      assertCaseListQuery(request)
      const normalizedRequest: ListCasesQuery = {
        ...request,
        ...(request.search !== undefined ? { search: request.search.trim() } : {}),
      }
      return operationExecutor.execute(
        listCasesOperation,
        executionContext,
        normalizedRequest,
        async (input, context) => {
          const limit = input.limit ?? 25
          const search = input.search
          const repository = createCaseRepository(context.entityManager)
          const result = await repository.list(context.executionContext.organizationId, {
            ...(input.cursor ? { cursor: decodeCaseCursor(input.cursor) } : {}),
            ...(input.customerId ? { customerId: input.customerId } : {}),
            limit,
            ...(search ? { search } : {}),
            ...(input.status ? { status: input.status } : {}),
            ...(input.statusGroup ? { statusGroup: input.statusGroup } : {}),
          })
          const last = result.items.at(-1)
          return {
            items: result.items.map(toCase),
            nextCursor: result.hasMore && last ? encodeCaseCursor(last) : null,
          }
        },
      )
    },
    async transition(caseId, request, executionContext) {
      const normalizedRequest = normalizeCaseTransition(request)
      const operation = transitionOperation(normalizedRequest)
      try {
        return await operationExecutor.execute(
          operation,
          executionContext,
          { caseId, request: normalizedRequest },
          async (input, context) => {
            const historyRepository = createCaseStatusChangeRepository(context.entityManager)
            const replay = await historyRepository.findByTransitionId(
              context.executionContext.organizationId,
              input.request.transitionId,
            )
            if (replay) return resolveReplay(replay, input.caseId, input.request)

            const caseRepository = createCaseRepository(context.entityManager)
            const record = await requireCase(
              caseRepository,
              context.executionContext.organizationId,
              input.caseId,
            )
            assertVersion(record, input.request.expectedVersion)
            if (record.status !== input.request.fromStatus) {
              throw new CaseValidationError('The case is not in the declared source status.')
            }

            const now = new Date()
            const note = transitionNote(input.request)
            const resultingVersion = record.version + 1
            record.status = input.request.toStatus
            record.statusNote = note ?? null
            record.closedAt = isTerminalStatus(input.request.toStatus) ? now : null
            record.updatedAt = now
            const change = context.entityManager.create(CaseStatusChangeEntity, {
              actorId: context.executionContext.actor.id,
              actorType: context.executionContext.actor.type,
              caseId: record.id,
              caseVersion: resultingVersion,
              changedAt: now,
              expectedVersion: input.request.expectedVersion,
              fromStatus: input.request.fromStatus,
              id: randomUUID(),
              note: note ?? null,
              organizationId: context.executionContext.organizationId,
              source: 'runtime',
              toStatus: input.request.toStatus,
              transitionId: input.request.transitionId,
              type: 'transitioned',
            })
            context.entityManager.persist(change)
            await context.entityManager.flush()
            context.emit({
              aggregateId: record.id,
              aggregateVersion: record.version,
              definition: caseTransitionedEvent,
              occurredAt: change.changedAt,
              payload: {
                caseId: record.id,
                caseVersion: record.version,
                fromStatus: input.request.fromStatus,
                note: change.note ?? null,
                statusChangeId: change.id,
                toStatus: input.request.toStatus,
                transitionId: input.request.transitionId,
              },
            })
            return toStatusChange(change)
          },
        )
      } catch (error) {
        if (
          error instanceof UniqueConstraintViolationException ||
          error instanceof OptimisticLockError
        ) {
          const replay = await findTransitionReplay(
            entityManager,
            executionContext.organizationId,
            normalizedRequest.transitionId,
          )
          if (replay) return resolveReplay(replay, caseId, normalizedRequest)
          if (error instanceof OptimisticLockError) {
            throw new CaseVersionConflictError(
              await readCurrentVersion(entityManager, executionContext.organizationId, caseId),
            )
          }
          if (isRuntimeCaseVersionConstraint(error)) {
            const currentVersion = await readCurrentVersion(
              entityManager,
              executionContext.organizationId,
              caseId,
            )
            if (currentVersion !== normalizedRequest.expectedVersion) {
              throw new CaseVersionConflictError(currentVersion)
            }
          }
        }
        throw error
      }
    },
    update(caseId, request, executionContext) {
      const normalizedRequest: UpdateCaseRequest = {
        ...request,
        ...('description' in request
          ? { description: normalizeCaseDescription(request.description) }
          : {}),
        ...('title' in request ? { title: normalizeCaseTitle(request.title as string) } : {}),
      }
      return executeWithOptimisticConflict(
        () =>
          operationExecutor.execute(
            updateCaseOperation,
            executionContext,
            { caseId, request: normalizedRequest },
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
                const title = input.request.title as string
                if (record.title !== title) {
                  record.title = title
                  changedFields.push('title')
                }
              }
              if ('description' in input.request) {
                const description = input.request.description ?? null
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

function transitionOperation(request: ChangeCaseStatusRequest): TransitionOperation {
  if (isTerminalStatus(request.toStatus)) return closeCaseOperation
  if (isTerminalStatus(request.fromStatus)) return reopenCaseOperation
  return transitionCaseOperation
}

function transitionNote(request: ChangeCaseStatusRequest) {
  return 'note' in request ? request.note : undefined
}

function resolveReplay(
  record: CaseStatusChangeRecord,
  caseId: CaseId,
  request: ChangeCaseStatusRequest,
): CaseStatusChange {
  if (
    record.caseId !== caseId ||
    record.expectedVersion !== request.expectedVersion ||
    record.fromStatus !== request.fromStatus ||
    record.toStatus !== request.toStatus ||
    (record.note ?? null) !== (transitionNote(request) ?? null)
  ) {
    throw new CaseTransitionIdConflictError(
      'The transition id has already been used for another command.',
    )
  }
  return toStatusChange(record)
}

async function findTransitionReplay(
  entityManager: EntityManager,
  organizationId: ExecutionContext['organizationId'],
  transitionId: string,
) {
  return createCaseStatusChangeRepository(entityManager).findByTransitionId(
    organizationId,
    transitionId,
  )
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
    if (error instanceof OptimisticLockError) return resolveConflict()
    throw error
  }
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

function isRuntimeCaseVersionConstraint(
  error: UniqueConstraintViolationException | OptimisticLockError,
): error is UniqueConstraintViolationException {
  return (
    error instanceof UniqueConstraintViolationException &&
    Reflect.get(error, 'constraint') === 'case_status_changes_org_case_version_runtime_unique'
  )
}

function isTerminalStatus(status: CaseStatus): status is 'canceled' | 'resolved' {
  return status === 'canceled' || status === 'resolved'
}

export function toCase(record: CaseRecord): Case {
  return {
    closedAt: record.closedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    customerId: record.customerId ?? null,
    description: record.description ?? null,
    id: record.id,
    organizationId: record.organizationId,
    status: record.status,
    statusNote: record.statusNote ?? null,
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
    version: record.version,
  }
}

function toStatusChange(record: CaseStatusChangeRecord): CaseStatusChange {
  return {
    actorId: record.actorId,
    actorType: record.actorType,
    caseId: record.caseId,
    caseVersion: record.caseVersion,
    changedAt: record.changedAt.toISOString(),
    fromStatus: record.fromStatus ?? null,
    id: record.id,
    note: record.note ?? null,
    source: record.source,
    toStatus: record.toStatus,
    transitionId: record.transitionId ?? null,
    type: record.type,
  }
}

function encodeCaseCursor(record: Pick<CaseRecord, 'id' | 'updatedAt'>) {
  return Buffer.from(
    JSON.stringify({ id: record.id, updatedAt: record.updatedAt.toISOString() }),
  ).toString('base64url')
}

function decodeCaseCursor(value: string): CaseCursor {
  const decoded = decodeCursor(value, 'updatedAt')
  return { id: decoded.id as CaseId, updatedAt: decoded.date }
}

function decodeCursor(value: string, dateKey: 'updatedAt') {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid cursor')
    const dateValue = Reflect.get(parsed, dateKey)
    const id = Reflect.get(parsed, 'id')
    const date = new Date(typeof dateValue === 'string' ? dateValue : '')
    if (
      Number.isNaN(date.valueOf()) ||
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new Error('Invalid cursor')
    }
    return { date, id }
  } catch {
    throw new InvalidCaseCursorError('Invalid case cursor.')
  }
}
