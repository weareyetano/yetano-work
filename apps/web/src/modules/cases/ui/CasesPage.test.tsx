// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { closeCase, createCase, listCases, reopenCase, updateCase } from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CasesPage } from './CasesPage'

vi.mock('@yetano/api-client', () => ({
  closeCase: vi.fn(),
  createCase: vi.fn(),
  listCases: vi.fn(),
  reopenCase: vi.fn(),
  updateCase: vi.fn(),
}))

const caseItem = {
  closedAt: null,
  createdAt: '2026-08-19T10:00:00.000Z',
  customerId: null,
  description: 'Customer sees an outdated invoice.',
  id: '122c8615-6bcd-4a36-90e6-d18ca0c06928',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  status: 'open' as const,
  title: 'Invoice access',
  updatedAt: '2026-08-19T10:00:00.000Z',
  version: 1,
}

describe('CasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
  })

  it('renders the deliberate empty state', async () => {
    renderCasesPage()

    expect(await screen.findByText('Brak spraw w tym widoku.')).toBeInTheDocument()
    expect(screen.getByText('Utwórz pierwszą sprawę albo zmień filtr statusu.')).toBeInTheDocument()
  })

  it('creates a case through the generated client', async () => {
    vi.mocked(createCase).mockResolvedValue(apiResult(caseItem))
    const user = userEvent.setup()
    renderCasesPage()

    await screen.findByText('Brak spraw w tym widoku.')
    await user.type(screen.getByLabelText('Tytuł'), 'Invoice access')
    await user.click(screen.getByRole('button', { name: 'Utwórz sprawę' }))

    await waitFor(() =>
      expect(createCase).toHaveBeenCalledWith({
        body: { customerId: null, description: null, title: 'Invoice access' },
        throwOnError: true,
      }),
    )
  })

  it('selects and closes an open case with its current version', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(closeCase).mockResolvedValue(
      apiResult({
        ...caseItem,
        closedAt: '2026-08-19T11:00:00.000Z',
        status: 'closed' as const,
        version: 2,
      }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Zamknij sprawę' }))

    await waitFor(() =>
      expect(closeCase).toHaveBeenCalledWith({
        body: { expectedVersion: 1 },
        path: { caseId: caseItem.id },
        throwOnError: true,
      }),
    )
    expect(reopenCase).not.toHaveBeenCalled()
    expect(updateCase).not.toHaveBeenCalled()
  })
})

afterEach(cleanup)

function renderCasesPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CasesPage />
    </QueryClientProvider>,
  )
}

function apiResult<Data>(data: Data) {
  return {
    data,
    error: undefined,
    request: new Request('http://localhost/api/v1/cases'),
    response: new Response(),
  }
}
