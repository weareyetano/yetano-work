// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createCase,
  getCase,
  listCaseStatusHistory,
  listCases,
  transitionCase,
  updateCase,
} from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CasesPage } from './CasesPage'

vi.mock('@yetano/api-client', () => ({
  createCase: vi.fn(),
  getCase: vi.fn(),
  listCaseStatusHistory: vi.fn(),
  listCases: vi.fn(),
  transitionCase: vi.fn(),
  updateCase: vi.fn(),
}))

const caseItem = {
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
    vi.mocked(listCaseStatusHistory).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
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

  it('selects a case from the keyboard and exposes the selected state', async () => {
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    const secondCase = await screen.findByRole('button', { name: /Second case/ })
    secondCase.focus()
    await user.keyboard(' ')

    expect(secondCase).toHaveFocus()
    expect(secondCase).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('heading', { name: 'Second case' })).toBeVisible()
  })

  it('opens one mobile detail view and restores the triggering case from the icon-only back button', async () => {
    mockDesktopViewport(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(320)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onSelectedIdChange })

    const listTitle = await screen.findByRole('heading', { level: 1, name: 'Sprawy' })
    const secondCase = await screen.findByRole('button', { name: /Second case/ })
    await user.click(secondCase)

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(secondCaseItem.id, 'push')
    expect(listTitle).not.toBeVisible()
    const detailTitle = screen.getByRole('heading', { level: 1, name: 'Second case' })
    expect(detailTitle).toBeVisible()
    await waitFor(() => expect(detailTitle).toHaveFocus())

    const back = screen.getByRole('button', { name: 'Wróć do listy spraw' })
    expect(back.textContent).toBe('')
    await user.click(back)

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(null, 'replace')
    expect(listTitle).toBeVisible()
    await waitFor(() => expect(secondCase).toHaveFocus())
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 320 })
  })

  it('keeps mobile back navigation available when a direct case link fails to load', async () => {
    mockDesktopViewport(false)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(getCase).mockRejectedValue(new Error('Nie znaleziono sprawy.'))
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onSelectedIdChange, requestedId: secondCaseItem.id })

    expect(await screen.findByText('Nie znaleziono sprawy.')).toBeVisible()
    const back = screen.getByRole('button', { name: 'Wróć do listy spraw' })
    await waitFor(() => expect(back).toHaveFocus())
    await user.click(back)

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(null, 'replace')
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

  it('starts work with an idempotent transition command and the current version', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(transitionCase).mockResolvedValue(apiResult(statusChange('working')))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Rozpocznij pracę' }))

    await waitFor(() =>
      expect(transitionCase).toHaveBeenCalledWith({
        body: {
          expectedVersion: 1,
          fromStatus: 'new',
          toStatus: 'working',
          transitionId: expect.any(String),
        },
        path: { caseId: caseItem.id },
        throwOnError: true,
      }),
    )
    expect(updateCase).not.toHaveBeenCalled()
  })

  it('requires and displays a note when moving a case to waiting', async () => {
    const waitingCase = {
      ...caseItem,
      status: 'waiting' as const,
      statusNote: 'Oczekuje na odpowiedź klienta',
    }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [waitingCase], nextCursor: null }))
    vi.mocked(transitionCase).mockResolvedValue(
      apiResult(statusChange('waiting', 'Odpowiedź klienta')),
    )
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: 'Oczekuj' }))
    expect(screen.getByRole('dialog', { name: 'Na co czekamy?' })).toBeVisible()
    await user.type(screen.getByLabelText('Notatka'), 'Odpowiedź klienta')
    await user.click(screen.getByRole('button', { name: 'Ustaw oczekiwanie' }))

    await waitFor(() =>
      expect(transitionCase).toHaveBeenCalledWith({
        body: {
          expectedVersion: 1,
          fromStatus: 'new',
          note: 'Odpowiedź klienta',
          toStatus: 'waiting',
          transitionId: expect.any(String),
        },
        path: { caseId: caseItem.id },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Oczekuje na odpowiedź klienta')).toBeVisible()
  })

  it('displays the current status note for a canceled case', async () => {
    const canceledCase = {
      ...caseItem,
      closedAt: '2026-08-19T11:00:00.000Z',
      status: 'canceled' as const,
      statusNote: 'Zgłoszenie jest duplikatem',
    }
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [canceledCase], nextCursor: null }))

    renderCasesPage()

    expect(await screen.findByText('Zgłoszenie jest duplikatem')).toBeVisible()
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
    vi.mocked(transitionCase).mockRejectedValue(versionConflict(2))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Rozpocznij pracę' }))

    await waitFor(() => expect(listCases).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Rozpocznij pracę' })).toBeEnabled()
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

function statusChange(toStatus: 'waiting' | 'working', note: string | null = null) {
  return {
    actorId: 'development-user',
    actorType: 'user' as const,
    caseId: caseItem.id,
    caseVersion: 2,
    changedAt: '2026-08-19T11:00:00.000Z',
    fromStatus: 'new' as const,
    id: '1ddb62bc-cc28-442f-a324-0a8c0a4b48dd',
    note,
    source: 'runtime' as const,
    toStatus,
    transitionId: 'a64df03a-b392-4288-917b-45b04e578655',
    type: 'transitioned' as const,
  }
}

function mockDesktopViewport(matches: boolean) {
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
