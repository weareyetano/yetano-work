import { createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'

import { CasesPage } from '../modules/cases/ui/CasesPage'

export const Route = createFileRoute('/cases')({
  component: CasesRoute,
  validateSearch: (search): { caseId?: string } =>
    typeof search.caseId === 'string' && CASE_ID_PATTERN.test(search.caseId)
      ? { caseId: search.caseId }
      : {},
})

const CASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function CasesRoute() {
  const { caseId } = Route.useSearch()
  const navigate = Route.useNavigate()
  const setSelectedCaseId = useCallback(
    (nextCaseId: string | null) => {
      void navigate({
        replace: true,
        search: nextCaseId ? { caseId: nextCaseId } : {},
      })
    },
    [navigate],
  )

  return <CasesPage requestedId={caseId ?? null} onSelectedIdChange={setSelectedCaseId} />
}
