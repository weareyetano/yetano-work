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

    expect(await screen.findByText('Brak nowych spraw.')).toBeInTheDocument()
    expect(screen.getByText('Nowe sprawy pojawią się tutaj po utworzeniu.')).toBeInTheDocument()
    expect(screen.getByText('Brak wybranej sprawy.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Dodaj sprawę' })).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Nowa sprawa' })).not.toBeInTheDocument()
  })

  it('offers only the four work views and requests their exact filters', async () => {
    const user = userEvent.setup()
    renderCasesPage()

    const view = screen.getByRole('combobox', { name: 'Widok spraw' })
    expect(
      within(view)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Nowe', 'Pracujemy', 'Czekamy', 'Wszystkie'])
    expect(view).toHaveValue('new')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, status: ['new'] },
        throwOnError: true,
      }),
    )

    await user.selectOptions(view, 'working')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, status: ['working'] },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak spraw, nad którymi pracujemy.')).toBeVisible()

    await user.selectOptions(view, 'waiting')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, status: ['waiting'] },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak spraw, na które czekamy.')).toBeVisible()

    await user.selectOptions(view, 'all')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25 },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak spraw.')).toBeVisible()
  })

  it('selects the case requested in the URL before the last viewed case', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', caseItem.id)
    vi.mocked(listCases).mockResolvedValue(
      apiResult({ items: [caseItem, secondCaseItem], nextCursor: null }),
    )

    renderCasesPage({ requestedId: secondCaseItem.id })

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('loads a case requested in the URL when it is outside the visible list', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(getCase).mockResolvedValue(apiResult(secondCaseItem))

    renderCasesPage({ requestedId: secondCaseItem.id })

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
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

    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
  })

  it('selects the first visible case when the last viewed case is unavailable', async () => {
    localStorage.setItem('yetano:last-viewed-case-id', secondCaseItem.id)
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))

    renderCasesPage()

    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
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
    expect(secondCase).toHaveClass('border-0', 'bg-muted', 'text-foreground')
    expect(secondCase).not.toHaveClass('border-border', 'bg-accent')
    expect(within(secondCase).getByText(/Aktualizacja/)).toHaveClass('text-foreground/70')
    expect(await screen.findByDisplayValue('Second case')).toBeVisible()
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
    const detailTitle = screen.getByDisplayValue('Second case')
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

  it('opens mobile creation in place and restores the add button from the back control', async () => {
    mockDesktopViewport(false)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(180)
    const onCreateModeChange = vi.fn()
    const user = userEvent.setup()

    renderCasesPage({ onCreateModeChange })

    const listTitle = await screen.findByRole('heading', { level: 1, name: 'Sprawy' })
    const add = screen.getByRole('button', { name: 'Dodaj sprawę' })
    await user.click(add)

    expect(onCreateModeChange).toHaveBeenLastCalledWith(true, 'push')
    expect(listTitle).not.toBeVisible()
    expect(screen.getByRole('form', { name: 'Nowa sprawa' })).toBeVisible()
    expect(screen.getByLabelText('Tytuł')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Wróć do listy spraw' }))

    expect(onCreateModeChange).toHaveBeenLastCalledWith(false, 'replace')
    expect(listTitle).toBeVisible()
    await waitFor(() => expect(add).toHaveFocus())
    expect(scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', top: 180 })
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
    expect(screen.getByRole('combobox', { name: 'Widok spraw' })).toBeVisible()
    expect(screen.queryByLabelText('Id klienta (opcjonalnie)')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))

    const detail = screen.getByRole('article')
    const save = within(detail).getByRole('button', { name: 'Zapisz' })
    const work = within(detail).getByRole('button', { name: 'Pracuj' })
    expect(screen.queryByText(/Szczegóły · wersja/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Id klienta (opcjonalnie)')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Nowa')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Historia statusu')).not.toBeInTheDocument()
    expect(within(detail).queryByText('local-dev')).not.toBeInTheDocument()
    expect(save.compareDocumentPosition(work) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('marks only the newest history entry as current', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(listCaseStatusHistory).mockResolvedValue(
      apiResult({
        items: [
          statusChange('working'),
          {
            ...statusChange('resolved'),
            changedAt: '2026-08-19T10:30:00.000Z',
            id: '721317b8-e4e8-46b9-9ed8-1c34ad7448aa',
          },
        ],
        nextCursor: null,
      }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))

    const history = screen.getByRole('region', { name: 'Historia statusu' })
    const entries = within(history).getAllByRole('listitem')
    expect(within(history).queryByText('aktualny')).not.toBeInTheDocument()
    expect(entries[0]).toHaveAttribute('aria-current', 'true')
    expect(entries[1]).not.toHaveAttribute('aria-current')
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

    const view = screen.getByRole('combobox', { name: 'Widok spraw' })
    await screen.findByText('Brak nowych spraw.')
    await user.selectOptions(view, 'working')
    await screen.findByText('Brak spraw, nad którymi pracujemy.')
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
    await waitFor(() => expect(view).toHaveValue('new'))
    expect(onSelectedIdChange).toHaveBeenLastCalledWith(caseItem.id, 'replace')
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
  })

  it('cancels creation and restores the previously selected case', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    const onCreateModeChange = vi.fn()
    const onSelectedIdChange = vi.fn()
    const user = userEvent.setup()
    renderCasesPage({ onCreateModeChange, onSelectedIdChange })

    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    onSelectedIdChange.mockClear()
    const add = screen.getByRole('button', { name: 'Dodaj sprawę' })
    await user.click(add)
    const createForm = screen.getByRole('form', { name: 'Nowa sprawa' })
    await user.type(within(createForm).getByLabelText('Tytuł'), 'Draft title')
    await user.click(within(createForm).getByRole('button', { name: 'Anuluj' }))

    expect(onSelectedIdChange).toHaveBeenLastCalledWith(caseItem.id, 'replace')
    expect(screen.queryByRole('form', { name: 'Nowa sprawa' })).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Invoice access')).toBeVisible()
    await waitFor(() => expect(add).toHaveFocus())
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

    await screen.findByText('Brak nowych spraw.')
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
    expect(screen.getByRole('combobox', { name: 'Widok spraw' })).toHaveValue('working')
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
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
    expect(screen.getByRole('combobox', { name: 'Widok spraw' })).toHaveValue('waiting')
  })

  it('renders status history as separate borderless muted cards', async () => {
    const latestEntry = statusChange('waiting', 'Odpowiedź klienta')
    const olderEntry = {
      ...statusChange('working'),
      changedAt: '2026-08-19T10:30:00.000Z',
      id: '75bb9ef0-b103-4df7-89ce-efcbd2f79728',
    }
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(listCaseStatusHistory).mockResolvedValue(
      apiResult({ items: [latestEntry, olderEntry], nextCursor: null }),
    )

    renderCasesPage()

    const history = await screen.findByRole('region', { name: 'Historia statusu' })
    const rows = await within(history).findAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(history).queryByRole('heading')).not.toBeInTheDocument()
    expect(within(screen.getByRole('article')).queryByRole('separator')).not.toBeInTheDocument()
    expect(rows[0]).toHaveClass('rounded-xl', 'bg-muted/50', 'px-3', 'py-2.5')
    expect(rows[0]).not.toHaveClass('border', 'border-border')
    expect(rows[1]).toHaveClass('rounded-xl', 'bg-muted/50')
    expect(rows[0]?.parentElement).toHaveClass('grid', 'gap-2')
    expect(within(rows[0] as HTMLElement).getByText('Czekamy')).toHaveClass('text-sm')
    expect(within(rows[0] as HTMLElement).queryByText(/→|Utworzono jako/)).not.toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByRole('time')).toHaveClass(
      'shrink-0',
      'text-right',
      'text-xs',
    )
    expect(within(rows[0] as HTMLElement).getByRole('time').parentElement).toHaveClass(
      'flex',
      'justify-between',
    )
    expect(within(rows[0] as HTMLElement).getByText('Odpowiedź klienta')).toHaveClass('text-xs')
  })

  it('moves a resolved case to the all view and keeps its details open', async () => {
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

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Widok spraw' })).toHaveValue('all'),
    )
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  })

  it('moves a canceled case to the all view and keeps its details open', async () => {
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

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Widok spraw' })).toHaveValue('all'),
    )
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Otwórz ponownie' })).toBeVisible()
  })

  it('moves a reopened case to the working view and keeps its details open', async () => {
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

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Widok spraw' })).toHaveValue('working'),
    )
    expect(await screen.findByDisplayValue('Invoice access')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Oczekuj' })).toBeVisible()
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
    await user.click(screen.getByRole('button', { name: 'Zapisz' }))

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
    expect(await screen.findByDisplayValue('Title changed elsewhere')).toBeVisible()
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
    await user.click(screen.getByRole('button', { name: 'Pracuj' }))

    await waitFor(() => expect(listCases).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Pracuj' })).toBeEnabled()
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

function statusChange(
  toStatus: 'canceled' | 'resolved' | 'waiting' | 'working',
  note: string | null = null,
  fromStatus: 'canceled' | 'new' | 'resolved' | 'waiting' | 'working' = 'new',
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
