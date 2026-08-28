// @vitest-environment jsdom

import { cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { listCaseActivities, listCases } from '@yetano/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiResult,
  caseItem,
  getViewSelect,
  mockDesktopViewport,
  renderCasesPage,
  selectView,
  statusActivity,
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

describe('CasesPage leaf panels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
    vi.mocked(listCaseActivities).mockResolvedValue(apiResult({ items: [], nextCursor: null }))
  })
  it('renders the deliberate empty state', async () => {
    renderCasesPage()

    expect(await screen.findByText('Brak otwartych spraw.')).toBeInTheDocument()
    expect(screen.getByText('Nowe i aktywne sprawy pojawią się tutaj.')).toBeInTheDocument()
    expect(screen.getByText('Brak wybranej sprawy.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Dodaj sprawę' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1, name: 'Sprawy' })).toHaveClass('sr-only')
    expect(screen.queryByRole('form', { name: 'Nowa sprawa' })).not.toBeInTheDocument()
  })

  it('offers only the three lifecycle views and requests their exact filters', async () => {
    const user = userEvent.setup()
    renderCasesPage()

    const view = getViewSelect()
    await user.click(view)
    const listbox = screen.getByRole('listbox')
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Otwarte', 'Odłożone', 'Zamknięte'])
    expect(view).toHaveTextContent('Otwarte')
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, statusGroup: 'open' },
        throwOnError: true,
      }),
    )

    await selectView(user, 'Odłożone')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, status: ['postponed'] },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak odłożonych spraw.')).toBeVisible()

    await selectView(user, 'Zamknięte')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, statusGroup: 'closed' },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak zamkniętych spraw.')).toBeVisible()
  })

  it('debounces search inside the selected view and clears it directly', async () => {
    vi.mocked(listCases)
      .mockResolvedValueOnce(apiResult({ items: [caseItem], nextCursor: null }))
      .mockResolvedValue(apiResult({ items: [], nextCursor: null }))
    const user = userEvent.setup()
    renderCasesPage()

    await screen.findByRole('button', { name: /Invoice access/ })
    const initialCallCount = vi.mocked(listCases).mock.calls.length
    const search = screen.getByRole('searchbox', { name: 'Szukaj spraw' })
    await user.type(search, '  Invoice  ')

    expect(listCases).toHaveBeenCalledTimes(initialCallCount)
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, search: 'Invoice', statusGroup: 'open' },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak pasujących spraw.')).toBeVisible()
    expect(screen.getByText('Spróbuj innej frazy albo wyczyść wyszukiwanie.')).toBeVisible()

    await selectView(user, 'Odłożone')
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, search: 'Invoice', status: ['postponed'] },
        throwOnError: true,
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Wyczyść wyszukiwanie' }))
    expect(search).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Wyczyść wyszukiwanie' })).not.toBeInTheDocument()
    await waitFor(() =>
      expect(listCases).toHaveBeenLastCalledWith({
        query: { limit: 25, status: ['postponed'] },
        throwOnError: true,
      }),
    )
    expect(await screen.findByText('Brak odłożonych spraw.')).toBeVisible()
  })

  it('shows only the compact status row below the form', async () => {
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    const user = userEvent.setup()
    renderCasesPage()

    expect(screen.queryByText('Kolejka')).not.toBeInTheDocument()
    expect(getViewSelect()).toBeVisible()
    expect(screen.queryByLabelText('Id klienta (opcjonalnie)')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))

    const detail = screen.getByRole('article')
    const save = within(detail).getByRole('button', { name: 'Zapisz' })
    const work = within(detail).getByRole('button', { name: 'Pracuj' })
    expect(screen.queryByText(/Szczegóły · wersja/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Id klienta (opcjonalnie)')).not.toBeInTheDocument()
    expect(within(detail).getByText('Status sprawy:')).toBeVisible()
    const statusBadge = within(detail).getByText('Nowa')
    expect(statusBadge).toHaveAttribute('data-slot', 'badge')
    expect(statusBadge).toHaveClass('h-6', 'px-2.5', 'text-sm')
    expect(statusBadge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(within(detail).getByRole('time')).toHaveAttribute('datetime', caseItem.updatedAt)
    expect(within(detail).getByRole('button', { name: 'Pokaż aktywność' })).toBeVisible()
    expect(within(detail).queryByText('Pokaż aktywność')).not.toBeInTheDocument()
    expect(within(detail).queryByText('Informacje o sprawie')).not.toBeInTheDocument()
    expect(within(detail).queryByRole('region', { name: 'Aktywność' })).not.toBeInTheDocument()
    expect(within(detail).queryByText('Historia statusu')).not.toBeInTheDocument()
    expect(within(detail).queryByText('local-dev')).not.toBeInTheDocument()
    expect(save.compareDocumentPosition(work) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('renders newest activity first without exposing the raw actor id', async () => {
    const workingCase = {
      ...caseItem,
      status: 'working' as const,
      updatedAt: '2026-08-19T11:00:00.000Z',
      version: 2,
    }
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [workingCase], nextCursor: null }))
    vi.mocked(listCaseActivities).mockResolvedValue(
      apiResult({
        items: [
          statusActivity('working'),
          {
            ...statusActivity('resolved'),
            occurredAt: '2026-08-19T10:30:00.000Z',
            id: '721317b8-e4e8-46b9-9ed8-1c34ad7448aa',
          },
        ],
        nextCursor: null,
      }),
    )
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))
    const detail = screen.getByRole('article')
    expect(within(detail).getByText('Status sprawy:')).toBeVisible()
    expect(within(detail).getByText('Pracujemy')).toHaveAttribute('data-slot', 'badge')
    expect(within(detail).getByText('Pracujemy')).toHaveClass(
      'border-amber-300',
      'bg-amber-50',
      'text-amber-900',
    )
    expect(within(detail).getByRole('time')).toHaveAttribute('datetime', '2026-08-19T11:00:00.000Z')
    expect(within(detail).queryByText('Status: Pracujemy')).not.toBeInTheDocument()

    await user.click(within(detail).getByRole('button', { name: 'Pokaż aktywność' }))

    const timeline = screen.getByRole('region', { name: 'Aktywność' })
    expect(within(detail).queryByLabelText('Tytuł')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const breadcrumbs = within(timeline).getByRole('navigation', { name: 'Ścieżka sprawy' })
    expect(
      within(breadcrumbs).getByRole('button', { name: 'Wróć do sprawy: Invoice access' }),
    ).toBeVisible()
    const activityList = within(timeline).getByRole('list', { name: 'Oś czasu sprawy' })
    const entries = within(activityList).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('Użytkownik zmienił status na Pracujemy.')
    expect(within(timeline).queryByText('development-user')).not.toBeInTheDocument()

    await user.click(within(timeline).getByRole('button', { name: /Wróć do sprawy/ }))
    expect(await within(detail).findByLabelText('Tytuł')).toBeVisible()
    await waitFor(() =>
      expect(within(detail).getByRole('button', { name: 'Pokaż aktywność' })).toHaveFocus(),
    )
  })

  it('groups every available mobile status transition behind one menu', async () => {
    mockDesktopViewport(false)
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: /Invoice access/ }))

    const trigger = screen.getByRole('button', { name: 'Zmień status' })
    expect(screen.getByRole('button', { name: 'Zapisz' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Pracuj' })).not.toBeInTheDocument()
    await user.click(trigger)

    const menu = screen.getByRole('menu', { name: 'Zmień status' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Pracuj', 'Odłóż', 'Oczekuj', 'Rozwiąż', 'Anuluj'])

    await user.click(within(menu).getByRole('menuitem', { name: 'Oczekuj' }))
    expect(screen.getByRole('dialog', { name: 'Na co czekamy?' })).toBeVisible()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('renders activities as separate borderless muted cards in the activity view', async () => {
    const latestEntry = statusActivity('waiting', 'Odpowiedź klienta')
    const olderEntry = {
      ...statusActivity('working'),
      occurredAt: '2026-08-19T10:30:00.000Z',
      id: '75bb9ef0-b103-4df7-89ce-efcbd2f79728',
    }
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [caseItem], nextCursor: null }))
    vi.mocked(listCaseActivities).mockResolvedValue(
      apiResult({ items: [latestEntry, olderEntry], nextCursor: null }),
    )

    const waitingCase = {
      ...caseItem,
      status: 'waiting' as const,
      updatedAt: latestEntry.occurredAt,
      version: 2,
    }
    vi.mocked(listCases).mockResolvedValue(apiResult({ items: [waitingCase], nextCursor: null }))
    const user = userEvent.setup()
    renderCasesPage()

    await user.click(await screen.findByRole('button', { name: 'Pokaż aktywność' }))

    const timeline = await screen.findByRole('region', { name: 'Aktywność' })
    const activityList = await within(timeline).findByRole('list', { name: 'Oś czasu sprawy' })
    const rows = within(activityList).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(timeline).getByRole('heading', { name: 'Aktywność' })).toBeVisible()
    expect(rows[0]).toHaveClass('rounded-xl', 'bg-muted/50', 'px-3', 'py-2.5')
    expect(rows[0]).not.toHaveClass('border', 'border-border')
    expect(rows[1]).toHaveClass('rounded-xl', 'bg-muted/50')
    expect(rows[0]?.parentElement).toHaveClass('grid', 'gap-2')
    expect(rows[0]).toHaveTextContent(
      'Użytkownik zmienił status na Czekamy i dodał: „Odpowiedź klienta”',
    )
    expect(within(rows[0] as HTMLElement).getByText('Czekamy')).toHaveAttribute(
      'data-variant',
      'outline',
    )
    expect(within(rows[0] as HTMLElement).getByText('Czekamy')).toHaveClass(
      'border-sky-300',
      'bg-sky-50',
      'text-sky-800',
    )
    expect(within(rows[0] as HTMLElement).getByText('Czekamy')).toHaveClass(
      '-translate-y-0.5',
      'h-6',
      'px-2.5',
      'text-sm',
    )
    expect(rows[0]?.querySelector('p')).toHaveClass('text-sm')
    expect(within(rows[0] as HTMLElement).getByRole('time')).toHaveClass(
      'shrink-0',
      'text-right',
      'text-xs',
    )
    expect(within(rows[0] as HTMLElement).getByRole('time').parentElement).toHaveClass(
      'flex',
      'justify-between',
    )
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
