import type {
  Case,
  CaseId,
  CaseList,
  CaseStatusChange,
  CaseStatusHistory,
  CaseStatusHistoryQuery,
  ChangeCaseStatusRequest,
  CreateCaseRequest,
  ListCasesQuery,
  UpdateCaseRequest,
} from '@yetano/contracts'

import { defineOperation } from '../../platform/execution/operation.js'
import { CASES_CAPABILITIES } from './cases.capabilities.js'

export interface CaseMutationInput<T> {
  caseId: CaseId
  request: T
}

export const createCaseOperation = defineOperation<CreateCaseRequest, Case>({
  capability: CASES_CAPABILITIES.create,
  id: 'cases.create',
  kind: 'command',
})

export const listCasesOperation = defineOperation<ListCasesQuery, CaseList>({
  capability: CASES_CAPABILITIES.read,
  id: 'cases.list',
  kind: 'query',
})

export const getCaseOperation = defineOperation<CaseId, Case>({
  capability: CASES_CAPABILITIES.read,
  id: 'cases.get',
  kind: 'query',
})

export const listCaseStatusHistoryOperation = defineOperation<
  CaseMutationInput<CaseStatusHistoryQuery>,
  CaseStatusHistory
>({
  capability: CASES_CAPABILITIES.read,
  id: 'cases.status-history',
  kind: 'query',
})

export const updateCaseOperation = defineOperation<CaseMutationInput<UpdateCaseRequest>, Case>({
  capability: CASES_CAPABILITIES.update,
  id: 'cases.update',
  kind: 'command',
})

export const transitionCaseOperation = defineOperation<
  CaseMutationInput<ChangeCaseStatusRequest>,
  CaseStatusChange
>({
  capability: CASES_CAPABILITIES.transition,
  id: 'cases.transition',
  kind: 'command',
})

export const closeCaseOperation = defineOperation<
  CaseMutationInput<ChangeCaseStatusRequest>,
  CaseStatusChange
>({
  capability: CASES_CAPABILITIES.close,
  id: 'cases.close',
  kind: 'command',
})

export const reopenCaseOperation = defineOperation<
  CaseMutationInput<ChangeCaseStatusRequest>,
  CaseStatusChange
>({
  capability: CASES_CAPABILITIES.reopen,
  id: 'cases.reopen',
  kind: 'command',
})

export const casesOperations = [
  closeCaseOperation,
  createCaseOperation,
  getCaseOperation,
  listCasesOperation,
  listCaseStatusHistoryOperation,
  reopenCaseOperation,
  transitionCaseOperation,
  updateCaseOperation,
] as const
