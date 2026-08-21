import {
  type CreateCaseResponse,
  createCase,
  getCase,
  type ListCaseStatusHistoryResponse,
  type ListCasesResponse,
  listCaseStatusHistory,
  listCases,
  type TransitionCaseData,
  type TransitionCaseResponse,
  transitionCase,
  type UpdateCaseError,
  type UpdateCaseResponse,
  updateCase,
} from '@yetano/api-client'

export type CaseItem = ListCasesResponse['items'][number]
export type CaseListPage = ListCasesResponse
export type CaseStatusFilter = 'all' | 'closed' | 'open' | CaseItem['status']
export type CaseStatusHistoryPage = ListCaseStatusHistoryResponse
export type CaseTransitionInput = TransitionCaseData['body']
export type CaseTransitionIntent = CaseTransitionInput extends infer Command
  ? Command extends CaseTransitionInput
    ? Omit<Command, 'expectedVersion' | 'fromStatus'>
    : never
  : never
type CaseVersionConflict = Extract<UpdateCaseError, { code: 'case_version_conflict' }>

export const caseQueryKeys = {
  all: ['cases'] as const,
  detail(caseId: string) {
    return [...this.all, 'detail', caseId] as const
  },
  history(caseId: string) {
    return [...this.all, 'history', caseId] as const
  },
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
      ...(status === 'open' || status === 'closed' ? { statusGroup: status } : {}),
      ...(status === 'all' || status === 'open' || status === 'closed' ? {} : { status: [status] }),
    },
    throwOnError: true,
  })
  return response.data
}

export async function fetchCaseStatusHistory(
  caseId: string,
  cursor: string | null,
): Promise<ListCaseStatusHistoryResponse> {
  const response = await listCaseStatusHistory({
    path: { caseId },
    query: { ...(cursor ? { cursor } : {}), limit: 50 },
    throwOnError: true,
  })
  return response.data
}

export async function fetchCase(caseId: string): Promise<CaseItem> {
  const response = await getCase({
    path: { caseId },
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

export async function transitionCaseItem(
  current: CaseItem,
  input: CaseTransitionIntent,
): Promise<TransitionCaseResponse> {
  const response = await transitionCase({
    body: {
      ...input,
      expectedVersion: current.version,
      fromStatus: current.status,
    } as CaseTransitionInput,
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
