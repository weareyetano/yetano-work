// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  closeCase,
  createCase,
  getCase,
  listCases,
  reopenCase,
  updateCase,
} from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CasesPage } from './CasesPage'

vi.mock('@yetano/api-client', () => ({
  closeCase: vi.fn(),
  createCase: vi.fn(),
  getCase: vi.fn(),
  listCases: vi.fn(),
  reopenCase: vi.fn(),
  updateCase: vi.fn(),
}))

const caseItem = {
  closedAt: null,
  createdAt: '2026-08-19T10:00:00.000Z',
  customerId: '8623cb78-b7de-43a6-bdce-47b7711474ef',
  description: 'Customer sees an outdated invoice.',
  id: '122c8615-6bcd-4a36-90e6-d18ca0c06928',
  organizationId: 'ddbdc2cc-bbc9-4426-97bf-d99520983bbb',
  status: 'open' as const,
  title: 'Invoice access',
  updatedAt: '2026-08-19T10:00:00.000Z',
  version: 1,
}

const secondCaseItem = {
  ...caseItem,
  id: '2a10c781-cd06-4b17-b63f-9fdb463e029b',
  title: 'Second case',
}

describe('CasesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
  })

  it('renders the deliberate empty state', async () => {
    renderCasesPage()

    expect(await screen.findByText('Brak spraw w tym widoku.')).toBeInTheDocument()
    expect(screen.getByText('Utwórz pierwszą sprawę albo zmień filtr statusu.')).toBeInTheDocument()
    expect(screen.getByText('Dodaj pierwszą sprawę.')).toBeVisible()
  })

  it('selects the case requested in the URL before the last viewed case', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', caseItem.id)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )

    renderCasesPage({ requestedId: secondCaseItem.id })

    expect(await screen.findByRole('heading', { name: 'Second case' })).toBeVisible()
  })

  it('loads a case requested in the URL when it is outside the visible list', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(getCase).mockResolvedValue(apiResult(secondCaseItem))

    renderCasesPage({ requestedId: secondCaseItem.id })

    expect(await screen.findByRole('heading', { name: 'Second case' })).toBeVisible()
    expect(getCase).toHaveBeenCalledWith({
      path: { caseId: secondCaseItem.id },
      throwOnError: true,
    })
  })

  it('selects the last viewed visible case before the first case', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', secondCaseItem.id)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )

    renderCasesPage()

    expect(await screen.findByRole('heading', { name: 'Second case' })).toBeVisible()
  })

  it('selects the first visible case when the last viewed case is unavailable', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', secondCaseItem.id)
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))

    renderCasesPage()

    expect(await screen.findByRole('heading', { name: 'Invoice access' })).toBeVisible()
  })

  it('omits the decorative labels and customer id field', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    const user = userEvent.setup()
    renderCasesPage()

    expect(screen.queryByText('Kolejka')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeVisible()
    expect(screen.queryByLabelText('Id klienta (opcjonalnie)')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))

    expect(screen.queryByText(/Szczegóły · wersja/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Id klienta (opcjonalnie)')).not.toBeInTheDocument()
  })

  it('creates a case through the generated client', async () => {
    vi.mocked(createCase).mockResolvedValue(apiResult(caseItem))
    const user = userEvent.setup()
    renderCasesPage()

    await screen.findByText('Brak spraw w tym widoku.')
    expect(screen.getByPlaceholderText('Nowa sprawa')).toBeVisible()
    expect(screen.queryByLabelText('Opis (opcjonalnie)')).not.toBeInTheDocument()
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

  it('refreshes the selected case after an update conflict', async () => {
    const refreshed = {
      ...caseItem,
      title: 'Title changed elsewhere',
      updatedAt: '2026-08-19T11:00:00.000Z',
      version: 2,
    }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValueOnce(apiResult({ items: [refreshed], nextCursor: null }))
    vi.mocked(updateCase).mockRejectedValue(versionConflict(2))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    const title = within(screen.getByRole('article')).getByLabelText('Tytuł')
    await user.clear(title)
    await user.type(title, 'Locally edited title')
    await user.click(screen.getByRole('button', { name: 'Zapisz zmiany' }))

    expect(updateCase).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ customerId: caseItem.customerId }),
      }),
    )
    expect(
      await screen.findByText(
        'Sprawa została zmieniona w innym miejscu. Sprawdź odświeżone dane i spróbuj ponownie.',
      ),
    ).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Title changed elsewhere' })).toBeVisible()
    expect(within(screen.getByRole('article')).getByLabelText('Tytuł')).toHaveValue(
      'Title changed elsewhere',
    )
    expect(listCases).toHaveBeenCalledTimes(2)
  })

  it('refreshes the selected case after a transition conflict', async () => {
    const refreshed = {
      ...caseItem,
      updatedAt: '2026-08-19T11:00:00.000Z',
      version: 2,
    }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValueOnce(apiResult({ items: [refreshed], nextCursor: null }))
    vi.mocked(closeCase).mockRejectedValue(versionConflict(2))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Zamknij sprawę' }))

    await waitFor(() => expect(listCases).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Zamknij sprawę' })).toBeEnabled()
  })
})

afterEach(cleanup)

function renderCasesPage(props: Parameters<typeof CasesPage>[0] = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <CasesPage {...props} />
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

function versionConflict(currentVersion: number) {
  return {
    code: 'case_version_conflict',
    currentVersion,
    status: 409,
    title: 'Conflict',
    type: 'about:blank',
  }
}
