import type { CaseStatus, ChangeCaseStatusRequest, ListCasesQuery } from '@yetano/contracts'

export class CaseValidationError extends Error {}

const CASE_TITLE_MAX_LENGTH = 200
const CASE_DESCRIPTION_MAX_LENGTH = 10_000
const CASE_STATUS_NOTE_MAX_LENGTH = 2_000
const CASE_SEARCH_MAX_LENGTH = 200
const CASE_LIST_MAX_LIMIT = 100

const caseStatuses = new Set<CaseStatus>([
  'canceled',
  'new',
  'postponed',
  'resolved',
  'waiting',
  'working',
])

const allowedTransitions: Readonly<Record<CaseStatus, ReadonlySet<CaseStatus>>> = {
  canceled: new Set(['working']),
  new: new Set(['canceled', 'postponed', 'resolved', 'waiting', 'working']),
  postponed: new Set(['canceled', 'new', 'resolved']),
  resolved: new Set(['working']),
  waiting: new Set(['canceled', 'resolved', 'working']),
  working: new Set(['canceled', 'resolved', 'waiting']),
}

export function normalizeCaseTitle(value: string): string {
  if (typeof value !== 'string') throw new CaseValidationError('Title must be a string.')
  const title = value.trim()
  if (!title) throw new CaseValidationError('Title cannot be blank.')
  if (title.length > CASE_TITLE_MAX_LENGTH) {
    throw new CaseValidationError(`Title cannot exceed ${CASE_TITLE_MAX_LENGTH} characters.`)
  }
  return title
}

export function normalizeCaseDescription(value: string | null | undefined): string | null {
  if (value == null) return null
  if (typeof value !== 'string') throw new CaseValidationError('Description must be a string.')
  const description = value.trim()
  if (description.length > CASE_DESCRIPTION_MAX_LENGTH) {
    throw new CaseValidationError(
      `Description cannot exceed ${CASE_DESCRIPTION_MAX_LENGTH} characters.`,
    )
  }
  return description || null
}

export function assertAllowedCaseTransition(fromStatus: CaseStatus, toStatus: CaseStatus): void {
  if (!isCaseStatus(fromStatus) || !isCaseStatus(toStatus)) {
    throw new CaseValidationError('The case transition contains an invalid status.')
  }
  if (!allowedTransitions[fromStatus].has(toStatus)) {
    throw new CaseValidationError(`Cases cannot transition from ${fromStatus} to ${toStatus}.`)
  }
}

export function normalizeStatusNote(value: string | undefined): string | null {
  if (value === undefined) return null
  if (typeof value !== 'string') throw new CaseValidationError('Status note must be a string.')
  const note = value.trim()
  if (note.length > CASE_STATUS_NOTE_MAX_LENGTH) {
    throw new CaseValidationError(
      `Status note cannot exceed ${CASE_STATUS_NOTE_MAX_LENGTH} characters.`,
    )
  }
  return note || null
}

export function normalizeCaseTransition(request: ChangeCaseStatusRequest): ChangeCaseStatusRequest {
  assertAllowedCaseTransition(request.fromStatus, request.toStatus)
  const noteIsForbidden =
    (request.fromStatus === 'new' && request.toStatus === 'postponed') ||
    (request.fromStatus === 'postponed' && request.toStatus === 'new')
  if ('note' in request && noteIsForbidden) {
    throw new CaseValidationError('A note is not allowed when postponing or restoring a case.')
  }
  const note = normalizeStatusNote('note' in request ? request.note : undefined)
  if ((request.toStatus === 'waiting' || request.toStatus === 'canceled') && !note) {
    throw new CaseValidationError('A note is required when waiting or canceling a case.')
  }
  if (!('note' in request)) return request
  const { note: _note, ...command } = request
  return (note ? { ...command, note } : command) as ChangeCaseStatusRequest
}

export function assertCaseListQuery(request: ListCasesQuery): void {
  if (
    request.limit !== undefined &&
    (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > CASE_LIST_MAX_LIMIT)
  ) {
    throw new CaseValidationError(`List limit must be between 1 and ${CASE_LIST_MAX_LIMIT}.`)
  }
  if (request.search !== undefined) {
    if (typeof request.search !== 'string') {
      throw new CaseValidationError('Search must be a string.')
    }
    const search = request.search.trim()
    if (!search || request.search.length > CASE_SEARCH_MAX_LENGTH) {
      throw new CaseValidationError(
        `Search must be non-blank and cannot exceed ${CASE_SEARCH_MAX_LENGTH} characters.`,
      )
    }
  }
  if (request.status !== undefined) assertStatusFilter(request.status)
  if (
    request.statusGroup !== undefined &&
    request.statusGroup !== 'open' &&
    request.statusGroup !== 'closed'
  ) {
    throw new CaseValidationError('Status group must be open or closed.')
  }
}

function assertStatusFilter(value: unknown) {
  if (!Array.isArray(value)) {
    throw new CaseValidationError('Status filter must be an array.')
  }
  const statuses = value
  if (statuses.length < 1 || statuses.length > caseStatuses.size) {
    throw new CaseValidationError(
      `Status filter must contain between 1 and ${caseStatuses.size} statuses.`,
    )
  }
  if (
    new Set(statuses).size !== statuses.length ||
    statuses.some((status) => !isCaseStatus(status))
  ) {
    throw new CaseValidationError('Status filter must contain unique valid case statuses.')
  }
}

function isCaseStatus(value: unknown): value is CaseStatus {
  return caseStatuses.has(value as CaseStatus)
}
