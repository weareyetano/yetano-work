import { createFileRoute } from '@tanstack/react-router'

import { CasesPage } from '../modules/cases/ui/CasesPage'

export const Route = createFileRoute('/cases')({
  component: CasesPage,
})
