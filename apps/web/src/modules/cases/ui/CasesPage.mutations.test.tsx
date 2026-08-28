// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  createCase,
  getCase,
  listCaseActivities,
  listCases,
  transitionCase,
  updateCase,
} from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiResult,
  caseItem,
  getViewSelect,
  renderCasesPage,
  selectView,
  statusChange,
  versionConflict,
} from './CasesPage.test-harness'

vi.mock('@yetano/api-client', () => ({
  createActivityNote: vi.fn(),
  createCase: vi.fn(),
  getCase: vi.fn(),
  listCaseActivities: vi.fn(),
  listCases: vi.fn(),
  transitionCase: vi.fn(),
  updateCase: vi.fn(),
}))

describe('CasesPage mutations and conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
    vi.mocked(listCaseActivities).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
  })

  it('creates a case through the generated client', async () => {
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(apiResult({ items: [], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(createCase).mockResolvedValue(apiResult(caseItem))
    const onCreateModeChange = vi.fn()
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()
    renderCasesPage({ onCreateModeChange, onSelectedIdChange })

    const view = getViewSelect()
    await screen.findByText('Brak otwartych spraw.')
    await selectView(user, 'Zamknięte')
    await screen.findByText('Brak zamkniętych spraw.')
    await user.click(screen.getByRole('button', { name: 'Dodaj sprawę' }))

    expect(onCreateModeChange).toHaveBeenLastCalledWith(true, 'push')
    const createPanel = screen.getByRole('article')
    const createForm = within(createPanel).getByRole('form', { name: 'Nowa sprawa' })
    expect(within(createPanel).queryByRole('heading')).not.toBeInTheDocument()
    expect(within(createPanel).queryByText('Nowa')).not.toBeInTheDocument()
    expect(within(createPanel).queryByText('Historia statusu')).not.toBeInTheDocument()
    expect(within(createPanel).queryByRole('button', { name: 'Pracuj' })).toBeNull()
    expect(within(createForm).getByLabelText('Tytuł')).toHaveFocus()
    expect(within(createForm).getByLabelText('Tytuł')).toBeRequired()
    expect(within(createForm).getByLabelText('Opis')).not.toBeRequired()
    await user.type(within(createForm).getByLabelText('Tytuł'), 'Invoice access')
    await user.type(within(createForm).getByLabelText('Opis'), 'Invoice details')
    await user.click(within(createForm).getByRole('button', { name: 'Utwórz sprawę' }))

    await waitFor(() =>
      expect(createCase).toHaveBeenCalledWith({
        body: { customerId: null, description: 'Invoice details', title: 'Invoice access' },
        throwOnError: true,
      }),
    )
    await waitFor(() => expect(view).toHaveTextContent('Otwarte'))
    expect(onSelectedIdChange).toHaveBeenLastCalledWith(caseItem.id, 'replace')
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
  })

  it('keeps the creation panel open ahead of an otherwise requested case', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))

    renderCasesPage({ createRequested: true, requestedId: caseItem.id })

    expect(await screen.findByRole('form', { name: 'Nowa sprawa' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Invoice access' })).not.toBeInTheDocument()
    expect(getCase).not.toHaveBeenCalled()
  })

  it('keeps the creation draft visible after an API error', async () => {
    vi.mocked(createCase).mockRejectedValue(new Error('Nie udało się utworzyć sprawy.'))
    const user = userEvent.setup()
    renderCasesPage()

    await screen.findByText('Brak otwartych spraw.')
    await user.click(screen.getByRole('button', { name: 'Dodaj sprawę' }))
    const createForm = screen.getByRole('form', { name: 'Nowa sprawa' })
    const title = within(createForm).getByLabelText('Tytuł')
    const description = within(createForm).getByLabelText('Opis')
    await user.type(title, 'Draft title')
    await user.type(description, 'Draft description')
    await user.click(within(createForm).getByRole('button', { name: 'Utwórz sprawę' }))

    expect(await within(createForm).findByText('Nie udało się utworzyć sprawy.')).toBeVisible()
    expect(title).toHaveValue('Draft title')
    expect(description).toHaveValue('Draft description')
  })

  it('starts work with an idempotent transition command and the current version', async () => {
    const workingCase = { ...caseItem, status: 'working' as const, version: 2 }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [workingCase], nextCursor: null }))
    vi.mocked(transitionCase).mockResolvedValue(apiResult(statusChange('working')))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Pracuj' }))

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
    expect(getViewSelect()).toHaveTextContent('Otwarte')
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Odłóż' })).not.toBeInTheDocument()
  })

  it('requires a note when moving a case to waiting without duplicating it above the form', async () => {
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
    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeVisible()
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
    expect(screen.queryByText('Oczekuje na odpowiedź klienta')).not.toBeInTheDocument()
    expect(getViewSelect()).toHaveTextContent('Otwarte')
    expect(screen.queryByRole('button', { name: 'Odłóż' })).not.toBeInTheDocument()
  })

  it('postpones a new case without a dialog and restores it as new', async () => {
    const postponedCase = {
      ...caseItem,
      status: 'postponed' as const,
      version: 2,
    }
    const restoredCase = { ...caseItem, version: 3 }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValueOnce(apiResult({ items: [postponedCase], nextCursor: null }))
      .mockResolvedValueOnce(apiResult({ items: [postponedCase], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [restoredCase], nextCursor: null }))
    vi.mocked(transitionCase)
      .mockResolvedValueOnce(apiResult(statusChange('postponed')))
      .mockResolvedValueOnce(
        apiResult({ ...statusChange('new', null, 'postponed'), caseVersion: 3 }),
      )
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: 'Odłóż' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(transitionCase).toHaveBeenNthCalledWith(1, {
        body: {
          expectedVersion: 1,
          fromStatus: 'new',
          toStatus: 'postponed',
          transitionId: expect.any(String),
        },
        path: { caseId: caseItem.id },
        throwOnError: true,
      }),
    )
    expect(getViewSelect()).toHaveTextContent('Odłożone')
    const detail = screen.getByRole('article')
    expect(within(detail).getByText('Status sprawy:')).toBeVisible()
    expect(within(detail).getByText('Odłożona')).toHaveAttribute('data-slot', 'badge')
    expect(screen.getByRole('button', { name: 'Przywróć' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pracuj' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Oczekuj' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Przywróć' }))

    await waitFor(() =>
      expect(transitionCase).toHaveBeenNthCalledWith(2, {
        body: {
          expectedVersion: 2,
          fromStatus: 'postponed',
          toStatus: 'new',
          transitionId: expect.any(String),
        },
        path: { caseId: caseItem.id },
        throwOnError: true,
      }),
    )
    expect(getViewSelect()).toHaveTextContent('Otwarte')
    expect(await screen.findByRole('button', { name: 'Odłóż' })).toBeVisible()
  })

  it('moves a resolved case to the closed view and keeps its details open', async () => {
    const resolvedCase = {
      ...caseItem,
      closedAt: '2026-08-19T11:00:00.000Z',
      status: 'resolved' as const,
      version: 2,
    }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [resolvedCase], nextCursor: null }))
    vi.mocked(transitionCase).mockResolvedValue(apiResult(statusChange('resolved')))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Rozwiąż' }))

    await waitFor(() => expect(getViewSelect()).toHaveTextContent('Zamknięte'))
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  })

  it('moves a canceled case to the closed view and keeps its details open', async () => {
    const canceledCase = {
      ...caseItem,
      closedAt: '2026-08-19T11:00:00.000Z',
      status: 'canceled' as const,
      statusNote: 'Duplikat',
      version: 2,
    }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [canceledCase], nextCursor: null }))
    vi.mocked(transitionCase).mockResolvedValue(apiResult(statusChange('canceled', 'Duplikat')))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: 'Anuluj' }))
    expect(screen.queryByText('Więcej działań')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Notatka'), 'Duplikat')
    await user.click(screen.getByRole('button', { name: 'Anuluj sprawę' }))

    await waitFor(() => expect(getViewSelect()).toHaveTextContent('Zamknięte'))
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  })

  it('moves a reopened case to the open view and keeps its details open', async () => {
    const canceledCase = {
      ...caseItem,
      closedAt: '2026-08-19T11:00:00.000Z',
      status: 'canceled' as const,
      statusNote: 'Duplikat',
      version: 2,
    }
    const reopenedCase = {
      ...caseItem,
      status: 'working' as const,
      version: 3,
    }
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [reopenedCase], nextCursor: null }))
    vi.mocked(getCase).mockResolvedValue(apiResult(canceledCase))
    vi.mocked(transitionCase).mockResolvedValue(
      apiResult(statusChange('working', null, 'canceled')),
    )
    const user = userEvent.setup()
    renderCasesPage({ requestedId: caseItem.id })

    await user.click(await screen.findByRole('button', { name: 'Otwórz ponownie' }))

    await waitFor(() => expect(getViewSelect()).toHaveTextContent('Otwarte'))
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Oczekuj' })).toBeVisible()
  })

  it('preserves the local draft after an update conflict until the server version is loaded', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

    expect(updateCase).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ customerId: caseItem.customerId }),
      }),
    )
    expect(await screen.findByText(/Lokalny szkic został zachowany/)).toBeInTheDocument()
    expect(screen.getByText(/Wersja serwera 2: Title changed elsewhere/)).toBeInTheDocument()
    expect(within(screen.getByRole('article')).getByLabelText('Tytuł')).toHaveValue(
      'Locally edited title',
    )
    expect(listCases).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Załaduj wersję z serwera' }))
    expect(within(screen.getByRole('article')).getByLabelText('Tytuł')).toHaveValue(
      'Title changed elsewhere',
    )
    expect(screen.queryByText(/Lokalny szkic został zachowany/)).not.toBeInTheDocument()
  })

  it('requires confirmation before a status change and discards only after consent', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(transitionCase).mockResolvedValue(apiResult(statusChange('postponed')))
    const user = userEvent.setup()
    renderCasesPage()

    const title = await screen.findByDisplayValue('Invoice access')
    await user.type(title, ' unsaved')
    await user.click(screen.getByRole('button', { name: 'Odłóż' }))

    let dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Zostań przy edycji' }))
    expect(transitionCase).not.toHaveBeenCalled()
    expect(title).toHaveValue('Invoice access unsaved')

    await user.click(screen.getByRole('button', { name: 'Odłóż' }))
    dialog = screen.getByRole('dialog', { name: 'Niezapisane zmiany' })
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zmiany' }))

    await waitFor(() => expect(transitionCase).toHaveBeenCalledTimes(1))
    expect(title).toHaveValue('Invoice access')
  })

  it('disables every other case mutation while an update is pending', async () => {
    const updatedCase = { ...caseItem, title: 'Updated title', version: 2 }
    let releaseUpdate!: () => void
    const updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve
    })
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(updateCase).mockImplementation(async () => {
      await updateGate
      return apiResult(updatedCase)
    })
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    const detail = screen.getByRole('article')
    const title = await within(detail).findByDisplayValue('Invoice access')
    await user.clear(title)
    await user.type(title, updatedCase.title)
    await user.click(within(detail).getByRole('button', { name: 'Zapisz' }))

    await waitFor(() => expect(updateCase).toHaveBeenCalledTimes(1))
    expect(title).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'Zapisywanie…' })).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'Pracuj' })).toBeDisabled()
    expect(within(detail).getByRole('button', { name: 'Odłóż' })).toBeDisabled()

    releaseUpdate()
    await waitFor(() =>
      expect(within(detail).getByRole('button', { name: 'Pracuj' })).toBeEnabled(),
    )
  })

  it('refreshes the selected case after a transition conflict without offering stale retry', async () => {
    const refreshed = {
      ...caseItem,
      status: 'working' as const,
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
    await user.click(screen.getByRole('button', { name: 'Pracuj' }))

    await waitFor(() => expect(listCases).toHaveBeenCalledTimes(2))
    expect(
      screen.getByText(
        'Sprawa została zmieniona w innym miejscu. Sprawdź odświeżone dane i wybierz właściwą akcję.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Spróbuj ponownie' })).not.toBeInTheDocument()
    expect(transitionCase).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Pracuj' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oczekuj' })).toBeEnabled()
  })

  it('retries a network failure with the same transition command and transition ID', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(transitionCase)
      .mockRejectedValueOnce(new TypeError('Brak połączenia z serwerem.'))
      .mockResolvedValueOnce(apiResult(statusChange('working')))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    await user.click(screen.getByRole('button', { name: 'Pracuj' }))

    expect(await screen.findByText('Brak połączenia z serwerem.')).toBeVisible()
    const firstBody = vi.mocked(transitionCase).mock.calls[0]?.[0].body
    expect(firstBody).toEqual({
      expectedVersion: 1,
      fromStatus: 'new',
      toStatus: 'working',
      transitionId: expect.any(String),
    })

    await user.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }))

    await waitFor(() => expect(transitionCase).toHaveBeenCalledTimes(2))
    const secondBody = vi.mocked(transitionCase).mock.calls[1]?.[0].body
    expect(secondBody).toEqual(firstBody)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
