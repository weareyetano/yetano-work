import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import { type ComponentType, createElement } from 'react'
import { vi } from 'vitest'

import { CasesPage } from './CasesPage'

export const caseItem = {
  closedAt: null,
  createdAt: '2026-08-19T10:00:00.000Z',
  customerId: '8623cb78-b7de-43a6-bdce-47b7711474ef',
  description: 'Customer sees an outdated invoice.',
  id: '122c8615-6bcd-4a36-90e6-d18ca0c06928',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  status: 'new' as const,
  statusNote: null,
  title: 'Invoice access',
  updatedAt: '2026-08-19T10:00:00.000Z',
  version: 1,
}

export const secondCaseItem = {
  ...caseItem,
  id: '2a10c781-cd06-4b17-b63f-9fdb463e029b',
  title: 'Second case',
}

export function getViewSelect() {
  return screen.getByRole('button', { name: /Widok spraw/ })
}

export async function selectView(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(getViewSelect())
  await user.click(await screen.findByRole('option', { name: label }))
}

export function apiResult<Data>(data: Data) {
  return {
    data,
    error: undefined,
    request: new Request('http://localhost/api/v1/cases'),
    response: new Response(),
  }
}

export function versionConflict(currentVersion: number) {
  return {
    code: 'case_version_conflict',
    currentVersion,
    status: 409,
    title: 'Conflict',
    type: 'about:blank',
  }
}

export function statusChange(
  toStatus: 'canceled' | 'new' | 'postponed' | 'resolved' | 'waiting' | 'working',
  note: string | null = null,
  fromStatus: 'canceled' | 'new' | 'postponed' | 'resolved' | 'waiting' | 'working' = 'new',
) {
  return {
    actorId: 'development-user',
    actorType: 'user' as const,
    caseId: caseItem.id,
    caseVersion: 2,
    changedAt: '2026-08-19T11:00:00.000Z',
    fromStatus,
    id: '1ddb62bc-cc28-442f-a324-0a8c0a4b48dd',
    note,
    source: 'runtime' as const,
    toStatus,
    transitionId: 'a64df03a-b392-4288-917b-45b04e578655',
    type: 'transitioned' as const,
  }
}

export function statusActivity(
  toStatus: 'canceled' | 'new' | 'postponed' | 'resolved' | 'waiting' | 'working',
  note: string | null = null,
) {
  return {
    actorId: 'development-user',
    actorType: 'user' as const,
    caseId: caseItem.id,
    caseVersion: 2,
    fromStatus: 'new' as const,
    id: '1ddb62bc-cc28-442f-a324-0a8c0a4b48dd',
    note,
    occurredAt: '2026-08-19T11:00:00.000Z',
    toStatus,
    type: 'case_status_changed' as const,
  }
}

export function mockDesktopViewport(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches,
      media: '(min-width: 721px)',
      removeEventListener: vi.fn(),
    }),
  )
}

export function renderCasesPage(props: Parameters<typeof CasesPage>[0] = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        CasesPage as ComponentType<NonNullable<Parameters<typeof CasesPage>[0]>>,
        props as NonNullable<Parameters<typeof CasesPage>[0]>,
      ),
    ),
  )
}
