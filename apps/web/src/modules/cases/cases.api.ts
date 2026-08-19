import {
  type CreateCaseResponse,
  closeCase,
  createCase,
  type ListCasesResponse,
  listCases,
  reopenCase,
  type UpdateCaseError,
  type UpdateCaseResponse,
  updateCase,
} from '@yetano/api-client'

export type CaseItem = ListCasesResponse['items'][number]
export type CaseListPage = ListCasesResponse
export type CaseStatusFilter = 'all' | CaseItem['status']
type CaseVersionConflict = Extract<UpdateCaseError, { code: 'case_version_conflict' }>

export const caseQueryKeys = {
  all: ['cases'] as const,
  list(status: CaseStatusFilter) {
    return [...this.all, 'list', status] as const
  },
}

export async function fetchCases({
  cursor,
  status,
}: {
  cursor: string | null
  status: CaseStatusFilter
}): Promise<ListCasesResponse> {
  const response = await listCases({
    query: {
      ...(cursor ? { cursor } : {}),
      limit: 25,
      ...(status === 'all' ? {} : { status }),
    },
    throwOnError: true,
  })
  return response.data
}

export async function createCaseItem(input: {
  customerId: string | null
  description: string | null
  title: string
}): Promise<CreateCaseResponse> {
  const response = await createCase({ body: input, throwOnError: true })
  return response.data
}

export async function updateCaseItem(
  current: CaseItem,
  input: { customerId: string | null; description: string | null; title: string },
): Promise<UpdateCaseResponse> {
  const response = await updateCase({
    body: { ...input, expectedVersion: current.version },
    path: { caseId: current.id },
    throwOnError: true,
  })
  return response.data
}

export async function transitionCaseItem(current: CaseItem): Promise<UpdateCaseResponse> {
  const operation = current.status === 'open' ? closeCase : reopenCase
  const response = await operation({
    body: { expectedVersion: current.version },
    path: { caseId: current.id },
    throwOnError: true,
  })
  return response.data
}

export function isCaseVersionConflict(error: unknown): error is CaseVersionConflict {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'code') === 'case_version_conflict' &&
    Reflect.get(error, 'status') === 409 &&
    typeof Reflect.get(error, 'currentVersion') === 'number'
  )
}
