import type {
  Case,
  CaseId,
  CaseList,
  CreateCaseRequest,
  ListCasesQuery,
  TransitionCaseRequest,
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

export const updateCaseOperation = defineOperation<CaseMutationInput<UpdateCaseRequest>, Case>({
  capability: CASES_CAPABILITIES.update,
  id: 'cases.update',
  kind: 'command',
})

export const closeCaseOperation = defineOperation<CaseMutationInput<TransitionCaseRequest>, Case>({
  capability: CASES_CAPABILITIES.close,
  id: 'cases.close',
  kind: 'command',
})

export const reopenCaseOperation = defineOperation<CaseMutationInput<TransitionCaseRequest>, Case>({
  capability: CASES_CAPABILITIES.close,
  id: 'cases.reopen',
  kind: 'command',
})

export const casesOperations = [
  createCaseOperation,
  listCasesOperation,
  getCaseOperation,
  updateCaseOperation,
  closeCaseOperation,
  reopenCaseOperation,
] as const
