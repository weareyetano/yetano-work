import type { CaseStatus } from '@yetano/contracts'

import type { ListCasesData } from './generated/types.gen.js'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Assert<Condition extends true> = Condition
type GeneratedListQuery = NonNullable<ListCasesData['query']>
type GeneratedCaseStatus = NonNullable<GeneratedListQuery['status']>[number]

export type GeneratedCaseStatusesMatchContract = Assert<Equal<GeneratedCaseStatus, CaseStatus>>

const combinedFilters = {
  status: ['new', 'working'],
  statusGroup: 'open',
} satisfies GeneratedListQuery

void combinedFilters
